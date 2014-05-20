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

#ifndef DECODER_H_
#define DECODER_H_

#include <memory>
#include <stdint.h>
#include <vector>

#include "dsp.h"

using namespace std;

namespace radioreceiver {

/**
 * A class to implement a worker that demodulates an FM broadcast station.
 */
class Decoder {
  static const int kInRate = 1008000;
  static const int kInterRate = 336000;
  static const int kOutRate = 48000;
  static const int kMaxF = 75000;
  static const int kPilotFreq = 19000;
  static const int kDeemphTc = 50;
  static const int kFilterFreq = 10000;
  static const int kFilterLen = 41;


  FMDemodulator demodulator_;
  vector<float> filterCoefs_;
  Downsampler monoSampler_;
  Downsampler stereoSampler_;
  StereoSeparator stereoSeparator_;
  Deemphasizer deemphasizer_;

 public:
  Decoder();

  /**
   * Demodulates the tuner's output, producing mono or stereo sound, and
   * sends the demodulated audio back to the caller.
   * @param buffer A buffer containing the tuner's output.
   * @param length The length of the buffer.
   * @param inStereo Whether to try decoding the stereo signal.
   * @param[out] leftAudio A pointer to store the left ear audio data.
   * @param[out] rightAudio A pointer to store the right ear audio data.
   */
  void process(uint8_t* buffer, int length, bool inStereo,
               unique_ptr<Samples>& leftAudio, unique_ptr<Samples>& rightAudio);
};

}  // namespace radioreceiver

#endif  // DECODER_H_

