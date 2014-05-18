// Copyright 2014 Google Inc. All rights reserved.
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
 * DSP functions and operations.
 */

#ifndef DSP_H_
#define DSP_H_

#include <stdint.h>

namespace radioreceiver {

/**
 * A class to store a list of floating-point samples with a given rate.
 */
class Samples {
  float *data_;
  int length_;
  int rate_;

 public:
  /**
   * Instance constructor.
   * @param data The sample array. The constructor takes ownership of it.
   * @param length The length of the sample array.
   * @param rate The sample rate.
   */
  Samples(float* data, int length, int rate)
      : data_(data), length_(length), rate_(rate) {}
  ~Samples() { delete data_; }

  int getRate() const { return rate_; }
  float* getData() const { return data_; }
  int getLength() const { return length_; }
};

/**
 * Converts the given buffer of unsigned 8-bit samples into a samples object.
 * @param buffer A buffer containing the unsigned 8-bit samples.
 * @param length The buffer's length.
 * @param rate The buffer's sample rate.
 * @return The converted samples. Ownership is transferred to the caller.
 */
Samples* samplesFromUint8(uint8_t* buffer, int length, int rate);

/**
 * Generates coefficients for a FIR low-pass filter with the given
 * half-amplitude frequency and kernel length at the given sample rate.
 * @param sampleRate The signal's sample rate.
 * @param halfAmplFreq The half-amplitude frequency in Hz.
 * @param length The length of the coefficient array. Must be an odd number.
 * @return The filter coefficients.
 */
float* getLowPassFIRCoeffs(int sampleRate, float halfAmplFreq, int length);

/**
 * A Finite Impulse Response filter.
 */
class FIRFilter {
  float* coefficients_;
  int coefLen_;
  int step_;
  int offset_;
  float* curSamples_;
  int curSampleLen_;
  int curSampleCap_;

 public:
  /**
   * Constructor for an filter with the given coefficients and step interval.
   * @param coefficients The coefficients of the filter to apply.
   * @param coefLen The number of filter coefficients.
   * @param step The stepping between samples.
   */
  FIRFilter(float* coefficients, int coefLen, int step = 1);
  ~FIRFilter();

  /**
   * Loads a new block of samples to filter.
   * @param samples The samples to load.
   */
  void loadSamples(const Samples& samples);

  /**
   * Returns a filtered sample.
   * @param index The index of the sample to return, corresponding
   *     to the same index in the latest sample block loaded via loadSamples().
   */  
  float get(int index);
};

/**
 * A class to apply a low-pass filter and resample to a lower sample rate.
 */
class Downsampler {
  FIRFilter filter_;
  float rateMul_;
  int outRate_;

 public:
  /**
   * Constructor with the given input and output rate and filter coefficients.
   * @param inRate The input signal's sample rate.
   * @param outRate The output signal's sample rate.
   * @param coefficients The coefficients for the FIR filter to apply to the
   *     original signal before downsampling it.
   * @param coefLen The length of the FIR filter coefficients.
   */
  Downsampler(int inRate, int outRate, float* coefficients, int coefLen);

  /**
   * Returns a downsampled version of the given samples.
   * @param samples The sample block to downsample.
   * @return The downsampled block. Ownership is transferred to the caller.
   */
  Samples* downsample(const Samples& samples);
};

/**
 * A class to downsample and deinterlace an I/Q stream coming from the tuner.
 */
class IQDownsampler {
  FIRFilter filter_;
  float rateMul_;
  int outRate_;

 public:
  /**
   * Constructor with the given input and output rate and filter coefficients.
   * @param inRate The input signal's sample rate.
   * @param outRate The output signal's sample rate.
   * @param coefficients The coefficients for the FIR filter to apply to the
   *     original signal before downsampling it.
   * @param coefLen The length of the FIR filter coefficients.
   */
  IQDownsampler(int inRate, int outRate, float* coefficients, int coefLen);

  /**
   * Returns a downsampled version of the given samples.
   * @param samples The sample block to downsample.
   * @param[out] samplesI Pointer to write the samples for the I stream to.
   *     Ownership is transferred to the caller.
   * @param[out] samplesQ Pointer to write the samples for the Q stream to.
   *     Ownership is transferred to the caller.
   */
  void downsample(const Samples& samples, Samples** samplesI, Samples** samplesQ);
};

/**
 * A class to demodulate IQ-interleaved samples into a raw audio signal.
 */
class FMDemodulator {
  static const float kGain;
  static const float kMaxFFactor;
  static const int kFilterLen = 51;

  int outRate_;
  float amplConv_;
  float* filterCoefs_;
  IQDownsampler downsampler_;
  float lI_;
  float lQ_;
 public:
  /**
   * Constructor for the given rates and maximum frequency deviation.
   * @param inRate The sample rate for the input signal.
   * @param outRate The sample rate for the output audio.
   * @param maxF The maximum frequency deviation.
   */ 
  FMDemodulator(int inRate, int outRate, int maxF);
  ~FMDemodulator();

  /**
   * Demodulates the given I/Q samples.
   * @param samples The samples to demodulate.
   * @return The demodulated sound. Ownership is transferred to the caller.
   */
  Samples* demodulateTuned(const Samples& samples);
};


/**
 * A container for a separated stereo signal.
 */
class StereoSignal {
  bool pilotDetected_;
  Samples* stereoDiff_;

 public:
  StereoSignal(bool pilotDetected, Samples* stereoDiff)
      : pilotDetected_(pilotDetected), stereoDiff_(stereoDiff) {}
  ~StereoSignal() { delete stereoDiff_; }

  bool wasPilotDetected() const { return pilotDetected_; }
  Samples* getStereoDiff() const { return stereoDiff_; }
};


/**
 * An exponential moving average accumulator.
 */
class ExpAverage {
  float weight_;
  bool calcStd_;
  float avg_;
  float std_;

 public:
  ExpAverage(int weight, bool calcStd = false);

  float add(float value);

  float getStd() { return std_; }
};


/**
 * A class to extract the stereo channel from a demodulated FM signal.
 */
class StereoSeparator {
  static const int kStdThres = 400;

  float sinTable_[8001];
  float cosTable_[8001];
  float sin_;
  float cos_;
  ExpAverage iavg_;
  ExpAverage qavg_;
  ExpAverage cavg_;

 public:
  /**
   * Constructor for the separator.
   * @param sampleRate The sample rate for the input signal.
   * @param pilotFreq The frequency of the pilot tone.
   */
  StereoSeparator(int sampleRate, int pilotFreq);
  
  /**
   * Locks on to the pilot tone and uses it to demodulate the stereo audio.
   * @param samples The original audio stream.
   * @return A container for the separated signal. Ownership is passed to
   *     the caller.
   */
  StereoSignal* separate(const Samples& samples);
};


/**
 * A de-emphasis filter.
 */
class Deemphasizer {
  double mult_;
  double val_;

 public:
  /**
   * Constructor for the given sample rate and time constant.
   * @param sampleRate The signal's sample rate.
   * @param timeConstant_uS The filter's time constant in microseconds.
   */
  Deemphasizer(int sampleRate, int timeConstant_uS);

  /**
   * Deemphasizes the given samples in place.
   * @param samples The samples to deemphasize.
   */
  void inPlace(const Samples& samples);
};


}  // namespace radioreceiver

#endif  // DSP_H_

