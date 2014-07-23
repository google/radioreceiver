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
 * Base class for decoders.
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
 * Base class for decoders.
 */
class Decoder {
 public:
  virtual ~Decoder() {}

  /**
   * Demodulates a block of floating-point samples, producing a block of
   * stereo audio.
   * @param samples The samples to decode.
   * @param inStereo Whether to try decoding a stereo signal.
   * @return The generated stereo audio block.
   */
  virtual StereoAudio decode(const Samples& samples, bool inStereo) = 0;
};

}  // namespace radioreceiver

#endif  // DECODER_BASE_H_
