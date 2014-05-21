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

#include "decoder.h"
#include "dsp.h"

using namespace std;

namespace radioreceiver {

Decoder::Decoder() : demodulator_(kInRate, kInterRate, kMaxF),
                     filterCoefs_(getLowPassFIRCoeffs(
                         kInterRate, kFilterFreq, kFilterLen)),
                     monoSampler_(kInterRate, kOutRate, filterCoefs_),
                     stereoSampler_(kInterRate, kOutRate, filterCoefs_),
                     stereoSeparator_(kInterRate, kPilotFreq),
                     deemphasizer_(kOutRate, kDeemphTc) {}

StereoAudio Decoder::process(uint8_t* buffer, int length, bool inStereo) {

  Samples samples(samplesFromUint8(buffer, length, kInRate));
  Samples demodulated(demodulator_.demodulateTuned(samples));

  StereoAudio output;
  output.inStereo = false;
  output.left = monoSampler_.downsample(demodulated);
  output.right = output.left;

  if (inStereo) {
    StereoSignal stereo(stereoSeparator_.separate(demodulated));
    if (stereo.wasPilotDetected()) {
      Samples diffAudio(stereoSampler_.downsample(stereo.getStereoDiff()));
      for (int i = 0; i < diffAudio.size(); ++i) {
        output.right[i] -= 2 * diffAudio[i];
        output.left[i] += 2 * diffAudio[i];
      }
      output.inStereo = true;
    }
  }

  deemphasizer_.inPlace(output.left);
  deemphasizer_.inPlace(output.right);
  return output;
}

}  // namespace radioreceiver
