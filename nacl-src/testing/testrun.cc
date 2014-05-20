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
 * Generates a test stereo modulated signal and demodulates it.
 */
#include <cmath>
#include <cstdio>
#include <memory>
#include <stdint.h>

#include "decoder.h"
#include "dsp.h"

using namespace radioreceiver;

const int kBufLen = 65536;
const int kFreq = 1000;
const float k2Pi = 2 * 3.14159265358979;

void fillWithStereo(int freqLeft, int freqRight,
                    uint8_t* buffer, int length) {
  int rate = Decoder::kInRate;
  int pilotFreq = Decoder::kPilotFreq;
  int maxF = Decoder::kMaxF;
  float outPhase = 0;
  for (int i = 0; i < length; i += 2) {
    float sampleLeft = cos(k2Pi * freqLeft * i / rate);
    float sampleRight = cos(k2Pi * freqRight * i / rate);
    float samplePilot = cos(k2Pi * pilotFreq * i / rate);
    float sampleSum = sampleLeft + sampleRight;
    float sampleDiff = sampleLeft - sampleRight;
    float sampleTop = sampleDiff * cos(k2Pi * 2 * pilotFreq * i / rate);
    float samplePre = sampleSum * .45 + samplePilot * .1 + sampleTop * .45;
    outPhase += k2Pi * samplePre * maxF / rate;
    float sampleI = cos(outPhase);
    float sampleQ = sin(outPhase);
    buffer[i] = 255 * (sampleI + 1) / 2;
    buffer[i + 1] = 255 * (sampleQ + 1) / 2;
  }
}

int main() {
  uint8_t buffer[kBufLen];

  fillWithStereo(997, 1499, buffer, 65536);

  Decoder decoder;
  StereoAudio audio = decoder.process(buffer, 65536, true);
  printf("Stereo: %s\n", audio.inStereo ? "true" : "false");
  printf("Signal [%lud]: ", audio.left.getData().size());
  for (int i = 0; i < audio.left.getData().size(); ++i) {
    printf("%f ", audio.left.getData()[i]);
  }
  printf("\n");
}
