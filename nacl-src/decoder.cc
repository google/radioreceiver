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

#include "decoder.h"
#include "dsp.h"

namespace radioreceiver {

Decoder::Decoder() : demodulator_(kInRate, kInterRate, kMaxF),
                     filterCoefs_(getLowPassFIRCoeffs(kInterRate, kFilterFreq, kFilterLen)),
                     monoSampler_(kInterRate, kOutRate, filterCoefs_, kFilterLen),
                     stereoSampler_(kInterRate, kOutRate, filterCoefs_, kFilterLen),
                     stereoSeparator_(kInterRate, kPilotFreq),
                     deemphasizer_(kOutRate, kDeemphTc) {}

Decoder::~Decoder() {
  delete filterCoefs_;
}

void Decoder::process(uint8_t* buffer, int length, bool inStereo,
    Samples** leftAudio, Samples** rightAudio) {

  Samples* samples = samplesFromUint8(buffer, length, kInRate);
  Samples* demodulated = demodulator_.demodulateTuned(*samples);
  delete samples;
  *leftAudio = monoSampler_.downsample(*demodulated);
  *rightAudio = 0;

  if (inStereo) {
    StereoSignal* stereo = stereoSeparator_.separate(*demodulated);
    if (stereo->wasPilotDetected()) {
      Samples* diffAudio = stereoSampler_.downsample(*stereo->getStereoDiff());
      float* diffAudioData = diffAudio->getData();
      float* leftAudioData = (*leftAudio)->getData();
      float* rightAudioData = new float[diffAudio->getLength()];
      for (int i = 0; i < diffAudio->getLength(); ++i) {
        rightAudioData[i] = leftAudioData[i] - diffAudioData[i];
        leftAudioData[i] += diffAudioData[i];
      }
      *rightAudio = new Samples(rightAudioData, diffAudio->getLength(), diffAudio->getRate());
      delete diffAudio;
      deemphasizer_.inPlace(**rightAudio);
    }
    delete stereo;
  }

  delete demodulated;
  deemphasizer_.inPlace(**leftAudio);
}

}  // namespace radioreceiver

