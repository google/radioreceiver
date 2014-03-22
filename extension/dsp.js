// Copyright 2013 Google Inc. All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview DSP functions and operations.
 */

/**
 * Generates coefficients for a FIR low-pass filter with the given
 * half-amplitude frequency and kernel length at the given sample rate.
 * @param {number} sampleRate The signal's sample rate.
 * @param {number} halfAmplFreq The half-amplitude frequency in Hz.
 * @param {number} The filter kernel's length. Should be an odd number.
 * @param {Float32Array} The FIR coefficients for the filter. 
 */
function getLowPassFIRCoeffs(sampleRate, halfAmplFreq, length) {
  length += (length + 1) % 2;
  var freq = halfAmplFreq / sampleRate;
  var coefs = new Float32Array(length);
  var center = Math.floor(length / 2);
  coefs[center] = 2 * Math.PI * freq;
  var sum = coefs[center];
  for (var i = 1; i < center; ++i) {
    var val = Math.sin(2 * Math.PI * freq * i) / i;
    val *= (0.42
        - 0.5 * Math.cos(2 * Math.PI * (center - i) / length)
        + 0.08 * Math.cos(4 * Math.PI * (center - i) / length));
    coefs[center + i] = coefs[center - i] = val;
    sum += 2 * val;
  }
  for (var i = 0; i < length; ++i) {
    coefs[i] /= sum;
  }
  return coefs;
}

/**
 * An object to apply a FIR filter to a sequence of samples.
 * @param {Float32Array} coefficients The coefficients of the filter to apply.
 * @param {number=} opt_step The stepping between samples (1 by default).
 * @constructor
 */
function FIRFilter(coefficients, opt_step) {
  var coefs = coefficients;
  var step = opt_step || 1;
  var offset = coefs.length * step;
  var curSamples = new Float32Array(offset);

  /**
   * Loads a new block of samples to filter.
   * @param {Samples} samples The samples to load.
   */
  function loadSamples(samples) {
    var newSamples = new Float32Array(samples.data.length + offset);
    newSamples.set(curSamples.subarray(curSamples.length - offset));
    newSamples.set(samples.data, offset);
    curSamples = newSamples;
  }

  /**
   * Returns a filtered sample.
   * Be very careful when you modify this function. About 85% of the total execution
   * time is spent here, so performance is critical.
   * @param {number} index The index of the sample to return, corresponding
   *     to the same index in the latest sample block loaded via loadSamples().
   */
  function get(index) {
    var out = 0;
    var sampleOff = index + offset;
    for (var i = coefs.length - 1; i >= 0; --i) {
      out += coefs[i] * curSamples[sampleOff - i * step];
    }
    return out;
  }

  return {
    get: get,
    loadSamples: loadSamples
  };
}

/**
 * Applies a low-pass filter and resamples to a lower sample rate.
 * @param {number} inRate The input signal's sample rate.
 * @param {number} outRate The output signal's sample rate.
 * @param {Float32Array} coefficients The coefficients for the FIR filter to
 *     apply to the original signal before downsampling it.
 * @constructor
 */
function Downsampler(inRate, outRate, coefficients) {
  var filter = new FIRFilter(coefficients);
  var rateMul = inRate / outRate;

  /**
   * Returns a downsampled version of the given samples.
   * @param {Samples} samples The sample block to downsample.
   * @return {Samples} The downsampled block.
   */
  function downsample(samples) {
    filter.loadSamples(samples);
    var outArr = new Float32Array(Math.floor(samples.data.length / rateMul));
    for (var i = 0, readFrom = 0; i < outArr.length; ++i, readFrom += rateMul) {
      outArr[i] = filter.get(Math.floor(readFrom));
    }
    return new Samples(outArr, outRate);
  }

  return {
    downsample: downsample
  };
}

/**
 * A downsampler for the interlaced I/Q stream coming from the tuner. Returns
 * the separated I and Q streams.
 * @param {number} inRate The input signal's sample rate.
 * @param {number} outRate The output signal's sample rate.
 * @param {Float32Array} coefficients The coefficients for the FIR filter to
 *     apply to the original signal before downsampling it.
 * @constructor
 */
function IQDownsampler(inRate, outRate, coefficients) {
  var filter = new FIRFilter(coefficients, 2);
  var rateMul = inRate / outRate;

  /**
   * Returns a downsampled version of each stream of samples.
   * @param {Samples} samples The sample block to downsample.
   * @return {Array.<Samples>} An array that contains first the downsampled I
   *     stream and next the downsampled Q stream.
   */
  function downsample(samples) {
    var numSamples = Math.floor(samples.data.length / (2 * rateMul));
    filter.loadSamples(samples);
    var outArrs = [new Float32Array(numSamples), new Float32Array(numSamples)];
    for (var i = 0, readFrom = 0; i < numSamples; ++i, readFrom += rateMul) {
      var idx = 2 * Math.floor(readFrom);
      outArrs[0][i] = filter.get(idx);
      outArrs[1][i] = filter.get(idx + 1);
    }
    return [new Samples(outArrs[0], outRate), new Samples(outArrs[1], outRate)];
  }

  return {
    downsample: downsample
  };
}

/**
 * A class to demodulate IQ-interleaved samples into a raw audio signal.
 * @param {number} inRate The sample rate for the input signal.
 * @param {number} outRate The sample rate for the output audio.
 * @param {number} maxF The maximum frequency deviation.
 * @constructor
 */
function FMDemodulator(inRate, outRate, maxF) {
  var GAIN = 1;
  var AMPL_CONV = outRate * GAIN / (2 * Math.PI * maxF);

  var coefs = getLowPassFIRCoeffs(inRate, maxF * 0.8, 51);
  var downsampler = new IQDownsampler(inRate, outRate, coefs);
  var lI = 0;
  var lQ = 0;

  /**
   * Demodulates the given I/Q samples.
   * @param {Samples} samples The samples to demodulate.
   * @returns {Samples} The demodulated sound.
   */
  function demodulateTuned(samples) {
    var IQ = downsampler.downsample(samples);
    var I = IQ[0].data;
    var Q = IQ[1].data;
    var out = new Float32Array(I.length);
    for (var i = 0; i < out.length; ++i) {
      var deltaAngle = ((I[i] * (Q[i] - lQ) - Q[i] * (I[i] - lI)) / (I[i] * I[i] + Q[i] * Q[i])) || 0;
      out[i] = (deltaAngle + deltaAngle * deltaAngle * deltaAngle / 3) * AMPL_CONV;
      lI = I[i];
      lQ = Q[i];
    }
    return new Samples(out, outRate);
  }
  
  return {
    demodulateTuned: demodulateTuned
  }
}

/**
 * Demodulates the stereo signal in a demodulated FM signal.
 * @param {number} sampleRate The sample rate for the input signal.
 * @param {number} pilotFreq The frequency of the pilot tone.
 * @constructor
 */
function StereoSeparator(sampleRate, pilotFreq) {
  var AVG_COEF = 9999;
  var STD_THRES = 400;
  var SIN = new Float32Array(8001);
  var COS = new Float32Array(8001);

  var sin = 0
  var cos = 1;
  var iavg = new ExpAverage(9999);
  var qavg = new ExpAverage(9999);
  var cavg = new ExpAverage(49999, true);

  for (var i = 0; i < 8001; ++i) {
    var freq = (pilotFreq + i / 100 - 40) * 2 * Math.PI / sampleRate;
    SIN[i] = Math.sin(freq);
    COS[i] = Math.cos(freq);
  }

  /**
   * Locks on to the pilot tone and uses it to demodulate the stereo audio.
   * @param {Samples} samples The original audio stream.
   * @return {Object} An object with a key 'stereo' that tells whether a
   *     consistent stereo pilot tone was detected and a key 'output'
   *     that contains the original stream demodulated with the
   *     reconstructed stereo carrier.
   */
  function separate(samples) {
    var out = new Float32Array(samples.data);
    for (var i = 0; i < out.length; ++i) {
      var hdev = iavg.add(out[i] * sin);
      var vdev = qavg.add(out[i] * cos);
      out[i] *= sin * cos * 2;
      var corr;
      if (hdev > 0) {
        corr = Math.max(-4, Math.min(4, vdev / hdev));
      } else {
        corr = vdev == 0 ? 0 : (vdev > 0 ? 4 : -4);
      }
      var idx = Math.round((corr + 4) * 1000);
      var newSin = sin * COS[idx] + cos * SIN[idx];
      cos = cos * COS[idx] - sin * SIN[idx];
      sin = newSin;
      cavg.add(corr * 10);
    }
    return {
      found: cavg.getStd() < STD_THRES,
      diff: new Samples(out, samples.rate)
    };
  }

  return {
    separate: separate
  };
}

/**
 * A de-emphasis filter with the given time constant.
 * @param {number} inRate The signal's sample rate.
 * @param {number} timeConstant_uS The filter's time constant in microseconds.
 * @constructor
 */
function Deemphasizer(sampleRate, timeConstant_uS) {
  var mult = Math.exp(-1e6 / (timeConstant_uS * sampleRate));
  var val = 0;

  /**
   * Deemphasizes the given samples in place.
   * @param {Samples} samples The samples to deemphasize.
   */
  function inPlace(samples) {
    for (var i = 0; i < samples.data.length; ++i) {
      val = (1- mult) * samples.data[i] + mult * val;
      samples.data[i] = val;
    }
  }

  return {
    inPlace: inPlace
  };
}

/**
 * An exponential moving average accumulator.
 * @param {number} weight Weight of the previous average value.
 * @param {boolean=} opt_std Whether to calculate the standard deviation.
 * @constructor
 */
function ExpAverage(weight, opt_std) {
  var avg = 0;
  var std = 0;

  /**
   * Adds a value to the moving average.
   * @param {number} value The value to add.
   * @return {number} The moving average.
   */
  function add(value) {
    avg = (weight * avg + value) / (weight + 1);
    if (opt_std) {
      std = (weight * std + (value - avg) * (value - avg)) / (weight + 1);
    }
    return avg;
  }

  /**
   * Returns the moving standard deviation.
   * @param {number} The moving standard deviation.
   */
  function getStd() {
    return std;
  }

  return {
    add: add,
    getStd: getStd
  };
}

/**
 * A class to store a list of floating-point samples with a given rate.
 * @param {Float32Array} floatArray An array of the samples.
 * @param {number} rate The sample rate.
 * @constructor
 */
function Samples(floatArray, rate) {
  return {
    rate: rate,
    data: floatArray
  };
}

/**
 * Converts the given buffer of unsigned 8-bit samples into a samples object.
 * @param {ArrayBuffer} buffer A buffer containing the unsigned 8-bit samples.
 * @param {number} rate The buffer's sample rate.
 */
function samplesFromUint8(buffer, rate) {
  var arr = new Uint8Array(buffer);
  var len = arr.length;
  var out = new Float32Array(len);
  for (var i = 0; i < len; ++i) {
    out[i] = arr[i] / 128.0 - 1;
  }
  return new Samples(out, rate);
}

