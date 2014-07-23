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
 * Receives samples captured by the tuner, demodulates them, extracts the
 * audio signals, and sends them back.
 */

#ifndef NBFM_DECODER_H_
#define NBFM_DECODER_H_

#include <memory>
#include <stdint.h>
#include <vector>

#include "decoder.h"
#include "dsp.h"

using namespace std;

namespace radioreceiver {

/**
 * A decoder for a Narrowband FM sample stream.
 */
class NBFMDecoder : public Decoder {
  static const int kInterRate = 48000;
  static const int kFilterFreq = 10000;
  static const int kFilterLen = 41;

  FMDemodulator demodulator_;
  vector<float> filterCoefs_;
  Downsampler downSampler_;
 public:
  /**
   * Constructor for the decoder.
   * @param inRate The sample rate for the input sample stream.
   * @param outRate The sample rate for the output stereo audio stream.
   *     The recommended rate is 48000.
   * @param maxF The frequency shift for maximum amplitude.
   */
  NBFMDecoder(int inRate, int outRate, int maxF);

  /**
   * Demodulates a block of floating-point samples, producing a block of
   * stereo audio.
   * @param samples The samples to decode.
   * @param inStereo Whether to try decoding the stereo signal.
   * @return The generated stereo audio block.
   */
  virtual StereoAudio decode(const Samples& samples, bool inStereo);
};

}  // namespace radioreceiver

#endif  // NBFM_DECODER_H_
