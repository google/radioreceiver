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

#include <memory>
#include <vector>

#include "dsp.h"
#include "nbfm_decoder.h"

using namespace std;

namespace radioreceiver {

NBFMDecoder::NBFMDecoder(int inRate, int outRate, int maxF)
    : demodulator_(inRate, kInterRate, maxF, maxF * 0.8, 351),
      filterCoefs_(getLowPassFIRCoeffs(kInterRate, kFilterFreq, kFilterLen)),
      downSampler_(kInterRate, outRate, filterCoefs_) {}

StereoAudio NBFMDecoder::decode(const Samples& samples) {
  Samples demodulated(demodulator_.demodulateTuned(samples));

  StereoAudio output;
  output.inStereo = false;
  output.left = downSampler_.downsample(demodulated);
  output.right = output.left;
  output.carrier = demodulator_.hasCarrier();
  return output;
}

}  // namespace radioreceiver
