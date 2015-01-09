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
 * @param {number} length The filter kernel's length. Should be an odd number.
 * @return {Float32Array} The FIR coefficients for the filter. 
 */
function getLowPassFIRCoeffs(sampleRate, halfAmplFreq, length) {
  length += (length + 1) % 2;
  var freq = halfAmplFreq / sampleRate;
  var coefs = new Float32Array(length);
  var center = Math.floor(length / 2);
  var sum = 0;
  for (var i = 0; i < length; ++i) {
    var val;
    if (i == center) {
      val = 2 * Math.PI * freq;
    } else {
      var angle = 2 * Math.PI * (i + 1) / (length + 1);
      val = Math.sin(2 * Math.PI * freq * (i - center)) / (i - center);
      val *= 0.42 - 0.5 * Math.cos(angle) + 0.08 * Math.cos(2 * angle);
    }
    sum += val;
    coefs[i] = val;
  }
  for (var i = 0; i < length; ++i) {
    coefs[i] /= sum;
  }
  return coefs;
}

/**
 * Multiplies an array that represents a signal by a sinusoidal.
 * @param {Float32Array} samples The array to multiply.
 * @param {number} sampleRate The signal's sample rate.
 * @param {number} freq The frequency to multiply by.
 * @param {boolean} cosine Whether to use cosine (sine otherwise).
 * @return {Float32Array} The multiplied array.
 */
function multiplyArray(samples, sampleRate, freq, cosine) {
  var out = new Float32Array(samples.length);
  var angFreq = 2 * Math.PI * freq / sampleRate;
  var center = Math.floor(out.length / 2);
  for (var i = 0; i < out.length; ++i) {
    var angle = angFreq * (center - i);
    out[i] = samples[i] * (cosine ? Math.cos(angle) : Math.sin(angle));
  }
  return out;
}

/**
 * Returns coefficients for a Hilbert transform.
 * @param {number} length The length of the kernel.
 * @param {bool} upper Whether to calculate the coefficients for USB.
 * @return {Float32Array} The kernel coefficients.
 */
function getHilbertCoeffs(length, upper) {
  length += (length + 1) % 2;
  var center = Math.floor(length / 2);
  var out = new Float32Array(length);
  for (var i = 0; i < out.length; ++i) {
    if ((i % 2) == 0) {
      out[i] = 2 / (Math.PI * (center - i));
    }
  }
  return out;
}

/**
 * An object to apply a FIR filter to a sequence of samples.
 * @param {Float32Array} coefficients The coefficients of the filter to apply.
 * @constructor
 */
function FIRFilter(coefficients) {
  var coefs = coefficients;
  var offset = coefs.length - 1;
  var center = Math.floor(coefs.length / 2);
  var curSamples = new Float32Array(offset);

  /**
   * Loads a new block of samples to filter.
   * @param {Float32Array} samples The samples to load.
   */
  function loadSamples(samples) {
    var newSamples = new Float32Array(samples.length + offset);
    newSamples.set(curSamples.subarray(curSamples.length - offset));
    newSamples.set(samples, offset);
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
    for (var i = 0; i < coefs.length; ++i) {
      out += coefs[i] * curSamples[index + i];
    }
    return out;
  }

  /**
   * Returns a delayed sample.
   * @param {number} index The index of the relative sample to return.
   */
  function getDelayed(index) {
    return curSamples[index + center];
  }

  return {
    get: get,
    loadSamples: loadSamples,
    getDelayed: getDelayed
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
   * @param {Float32Array} samples The sample block to downsample.
   * @return {Float32Array} The downsampled block.
   */
  function downsample(samples) {
    filter.loadSamples(samples);
    var outArr = new Float32Array(Math.floor(samples.length / rateMul));
    for (var i = 0, readFrom = 0; i < outArr.length; ++i, readFrom += rateMul) {
      outArr[i] = filter.get(Math.floor(readFrom));
    }
    return outArr;
  }

  return {
    downsample: downsample
  };
}

/**
 * A class to demodulate IQ-interleaved samples into a raw audio signal.
 * @param {number} inRate The sample rate for the input signal.
 * @param {number} outRate The sample rate for the output audio.
 * @param {number} filterFreq The bandwidth of the sideband.
 * @param {number} upper Whether we are demodulating the upper sideband.
 * @param {number} kernelLen The length of the filter kernel.
 * @constructor
 */
function SSBDemodulator(inRate, outRate, filterFreq, upper, kernelLen) {
  var coefs = getLowPassFIRCoeffs(inRate, 10000, kernelLen);
  var downsamplerI = new Downsampler(inRate, outRate, coefs);
  var downsamplerQ = new Downsampler(inRate, outRate, coefs);
  var coefsHilbert = getHilbertCoeffs(kernelLen);
  var filterDelay = new FIRFilter(coefsHilbert);
  var filterHilbert = new FIRFilter(coefsHilbert, upper);
  var coefsSide = getLowPassFIRCoeffs(outRate, filterFreq, kernelLen);
  var filterSide = new FIRFilter(coefsSide);
  var hilbertMul = upper ? -1 : 1;
  var powerLongAvg = new ExpAverage(outRate * 5);
  var powerShortAvg = new ExpAverage(outRate * 0.5);
  var sigRatio = inRate / outRate;
  var relSignalPower = 0;

  /**
   * Demodulates the given I/Q samples.
   * @param {Float32Array} samplesI The I component of the samples
   *     to demodulate.
   * @param {Float32Array} samplesQ The Q component of the samples
   *     to demodulate.
   * @returns {Float32Array} The demodulated sound.
   */
  function demodulateTuned(samplesI, samplesQ) {
    var I = downsamplerI.downsample(samplesI);
    var Q = downsamplerQ.downsample(samplesQ);

    var specSqrSum = 0;
    var sigSqrSum = 0;
    filterDelay.loadSamples(I);
    filterHilbert.loadSamples(Q);
    var prefilter = new Float32Array(I.length);
    for (var i = 0; i < prefilter.length; ++i) {
      prefilter[i] = filterDelay.getDelayed(i) + filterHilbert.get(i) * hilbertMul;
    }
    filterSide.loadSamples(prefilter);
    var out = new Float32Array(I.length);
    for (var i = 0; i < out.length; ++i) {
      var sig = filterSide.get(i);
      var power = sig * sig;
      sigSqrSum += power;
      var stPower = powerShortAvg.add(power);
      var ltPower = powerLongAvg.add(power);
      var multi = 0.9 * Math.max(1, Math.sqrt(2 / Math.min(1/128, Math.max(ltPower, stPower))));
      out[i] = multi * filterSide.get(i);
      var origIndex = Math.floor(i * sigRatio);
      var origI = samplesI[origIndex];
      var origQ = samplesQ[origIndex];
      specSqrSum += origI * origI + origQ * origQ;
    }

    relSignalPower = sigSqrSum / specSqrSum;
    return out;
  }

  function getRelSignalPower() {
    return relSignalPower;
  }

  return {
    demodulateTuned: demodulateTuned,
    getRelSignalPower: getRelSignalPower
  }
}

/**
 * A class to demodulate IQ-interleaved samples into a raw audio signal.
 * @param {number} inRate The sample rate for the input signal.
 * @param {number} outRate The sample rate for the output audio.
 * @param {number} filterFreq The frequency of the low-pass filter.
 * @param {number} kernelLen The length of the filter kernel.

 * @constructor
 */
function AMDemodulator(inRate, outRate, filterFreq, kernelLen) {
  var coefs = getLowPassFIRCoeffs(inRate, filterFreq, kernelLen);
  var downsamplerI = new Downsampler(inRate, outRate, coefs);
  var downsamplerQ = new Downsampler(inRate, outRate, coefs);
  var sigRatio = inRate / outRate;
  var relSignalPower = 0;

  /**
   * Demodulates the given I/Q samples.
   * @param {Float32Array} samplesI The I component of the samples
   *     to demodulate.
   * @param {Float32Array} samplesQ The Q component of the samples

   *     to demodulate.
   * @returns {Float32Array} The demodulated sound.
   */
  function demodulateTuned(samplesI, samplesQ) {
    var I = downsamplerI.downsample(samplesI);
    var Q = downsamplerQ.downsample(samplesQ);
    var iAvg = average(I);
    var qAvg = average(Q);
    var out = new Float32Array(I.length);

    var specSqrSum = 0;
    var sigSqrSum = 0;
    var sigSum = 0;
    for (var i = 0; i < out.length; ++i) {
      var iv = I[i] - iAvg;
      var qv = Q[i] - qAvg;
      var power = iv * iv + qv * qv;
      var ampl = Math.sqrt(power);
      out[i] = ampl;
      var origIndex = Math.floor(i * sigRatio);
      var origI = samplesI[origIndex];
      var origQ = samplesQ[origIndex];
      specSqrSum += origI * origI + origQ * origQ;
      sigSqrSum += power;
      sigSum += ampl;
    }
    var halfPoint = sigSum / out.length;
    for (var i = 0; i < out.length; ++i) {
      out[i] = (out[i] - halfPoint) / halfPoint;
    }
    relSignalPower = sigSqrSum / specSqrSum;
    return out;
  }

  function getRelSignalPower() {
    return relSignalPower;
  }

  return {
    demodulateTuned: demodulateTuned,
    getRelSignalPower: getRelSignalPower
  }
}

/**
 * A class to demodulate IQ-interleaved samples into a raw audio signal.
 * @param {number} inRate The sample rate for the input signal.
 * @param {number} outRate The sample rate for the output audio.
 * @param {number} maxF The maximum frequency deviation.
 * @param {number} filterFreq The frequency of the low-pass filter.
 * @param {number} kernelLen The length of the filter kernel.
 * @constructor
 */
function FMDemodulator(inRate, outRate, maxF, filterFreq, kernelLen) {
  var AMPL_CONV = outRate / (2 * Math.PI * maxF);

  var coefs = getLowPassFIRCoeffs(inRate, filterFreq, kernelLen);
  var downsamplerI = new Downsampler(inRate, outRate, coefs);
  var downsamplerQ = new Downsampler(inRate, outRate, coefs);
  var lI = 0;
  var lQ = 0;
  var relSignalPower = 0;

  /**
   * Demodulates the given I/Q samples.
   * @param {Float32Array} samplesI The I component of the samples
   *     to demodulate.
   * @param {Float32Array} samplesQ The Q component of the samples
   *     to demodulate.
   * @returns {Float32Array} The demodulated sound.
   */
  function demodulateTuned(samplesI, samplesQ) {
    var I = downsamplerI.downsample(samplesI);
    var Q = downsamplerQ.downsample(samplesQ);
    var out = new Float32Array(I.length);

    var prev = 0;
    var difSqrSum = 0;
    for (var i = 0; i < out.length; ++i) {
      var real = lI * I[i] + lQ * Q[i];
      var imag = lI * Q[i] - I[i] * lQ;
      var sgn = 1;
      if (imag < 0) {
        sgn *= -1;
        imag *= -1;
      }
      var ang = 0;
      var div;
      if (real == imag) {
        div = 1;
      } else if (real > imag) {
        div = imag / real;
      } else {
        ang = -Math.PI / 2;
        div = real / imag;
        sgn *= -1;
      }
      out[i] = sgn *
        (ang + div
               / (0.98419158358617365
                  + div * (0.093485702629671305
                           + div * 0.19556307900617517))) * AMPL_CONV;
      lI = I[i];
      lQ = Q[i];
      var dif = prev - out[i];
      difSqrSum += dif * dif;
      prev = out[i];
    }

    relSignalPower = 1 - Math.sqrt(difSqrSum / out.length);
    return out;
  }

  function getRelSignalPower() {
    return relSignalPower;
  }

  return {
    demodulateTuned: demodulateTuned,
    getRelSignalPower: getRelSignalPower
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
   * @param {Float32Array} samples The original audio stream.
   * @return {Object} An object with a key 'found' that tells whether a
   *     consistent stereo pilot tone was detected and a key 'diff'
   *     that contains the original stream demodulated with the
   *     reconstructed stereo carrier.
   */
  function separate(samples) {
    var out = new Float32Array(samples);
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
      diff: out
    };
  }

  return {
    separate: separate
  };
}

/**
 * A de-emphasis filter with the given time constant.
 * @param {number} sampleRate The signal's sample rate.
 * @param {number} timeConstant_uS The filter's time constant in microseconds.
 * @constructor
 */
function Deemphasizer(sampleRate, timeConstant_uS) {
  var alpha = 1 / (1 + sampleRate * timeConstant_uS / 1e6);
  var val = 0;

  /**
   * Deemphasizes the given samples in place.
   * @param {Float32Array} samples The samples to deemphasize.
   */
  function inPlace(samples) {
    for (var i = 0; i < samples.length; ++i) {
      val = val + alpha * (samples[i] - val);
      samples[i] = val;
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
 * Calculates the average of an array.
 * @param {Float32Array} arr The array to calculate its average.
 * @return {number} The average value.
 */
function average(arr) {
  var sum = 0;
  for (var i = 0; i < arr.length; ++i) {
    sum += arr[i];
  }
  return sum / arr.length;
}

/**
 * Converts the given buffer of unsigned 8-bit samples into a pair of 32-bit
 *     floating-point sample streams.
 * @param {ArrayBuffer} buffer A buffer containing the unsigned 8-bit samples.
 * @param {number} rate The buffer's sample rate.
 * @return {Array.<Float32Array>} An array that contains first the I stream
 *     and next the Q stream.
 */
function iqSamplesFromUint8(buffer, rate) {
  var arr = new Uint8Array(buffer);
  var len = arr.length / 2;
  var outI = new Float32Array(len);
  var outQ = new Float32Array(len);
  for (var i = 0; i < len; ++i) {
    outI[i] = arr[2 * i] / 128 - 0.995;
    outQ[i] = arr[2 * i + 1] / 128 - 0.995;
  }
  return [outI, outQ];
}

/**
 * Shifts a series of IQ samples by a given frequency.
 * @param {Array.<Float32Array>} IQ An array containing the I and Q streams.
 * @param {number} freq The frequency to shift the samples by.
 * @param {number} sampleRate The sample rate.
 * @param {number} cosine The cosine of the initial phase.
 * @param {number} sine The sine of the initial phase.
 * @return {Array} An array containing the I stream, Q stream,
 *     final cosine and final sine.
 */
function shiftFrequency(IQ, freq, sampleRate, cosine, sine) {
  var deltaCos = Math.cos(2 * Math.PI * freq / sampleRate);
  var deltaSin = Math.sin(2 * Math.PI * freq / sampleRate);
  var I = IQ[0];
  var Q = IQ[1];
  var oI = new Float32Array(I.length);
  var oQ = new Float32Array(Q.length);
  for (var i = 0; i < I.length; ++i) {
    oI[i] = I[i] * cosine - Q[i] * sine;
    oQ[i] = I[i] * sine + Q[i] * cosine;
    var newSine = cosine * deltaSin + sine * deltaCos;
    cosine = cosine * deltaCos - sine * deltaSin;
    sine = newSine;
  }
  return [oI, oQ, cosine, sine];
}

