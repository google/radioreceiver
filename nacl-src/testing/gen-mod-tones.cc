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
 * Generates a test modulated signal as it would be captured by the
 * USB dongle and writes it to stdout.
 */
#include <cmath>
#include <fstream>
#include <iostream>
#include <string>

using namespace std;

const int kBufLen = 65536;
const float k2Pi = 2 * 3.14159265358979;

struct Config {
  bool stereo;
  int leftFreq;
  int rightFreq;
  int rate;
  float duration;
};

void generate(Config cfg, uint8_t* buffer, int length) {
  static float phase = 0;
  static int sample = 0;
  int pilotFreq = 19000;
  int maxF = 75000;
  for (int i = 0; i < length / 2; ++i) {
    ++sample;
    float samplePre = 0;
    if (cfg.stereo) {
      float sampleLeft = sin(k2Pi * cfg.leftFreq * sample / cfg.rate);
      float sampleRight = sin(k2Pi * cfg.rightFreq * sample / cfg.rate);
      float samplePilot = sin(k2Pi * pilotFreq * sample / cfg.rate);
      float sampleSum = sampleLeft + sampleRight;
      float sampleDiff = sampleLeft - sampleRight;
      float sampleTop = sampleDiff *
          sin(k2Pi * 2 * pilotFreq * sample / cfg.rate);
      samplePre = sampleSum * .45 + samplePilot * .1 + sampleTop * .45;
    } else {
      samplePre = sin(k2Pi * cfg.leftFreq * sample / cfg.rate);
    }
    phase += k2Pi * samplePre * maxF / cfg.rate;
    float sampleI = cos(phase);
    float sampleQ = sin(phase);
    buffer[2 * i] = 255 * (sampleI + 1) / 2;
    buffer[2 * i + 1] = 255 * (sampleQ + 1) / 2;
  }
}

int main(int argc, char* argv[]) {
  Config cfg { true, 997, 1499, 1008000, 1.0 };

  for (int i = 1; i < argc; ++i) {
    if (string("-freq") == argv[i]) {
      cfg.leftFreq = stoi(argv[++i]);
      cfg.stereo = false;
    } else if (string("-left") == argv[i]) {
      cfg.leftFreq = stoi(argv[++i]);
    } else if (string("-right") == argv[i]) {
      cfg.rightFreq = stoi(argv[++i]);
    } else if (string("-mono") == argv[i]) {
      cfg.stereo = false;
    } else if (string("-rate") == argv[i]) {
      cfg.rate = stoi(argv[++i]);
    } else if (string("-duration") == argv[i]) {
      cfg.duration = stof(argv[++i]);
    } else {
      cerr << "Unknown flag: " << argv[i] << endl;
      return 1;
    }
  }

  uint8_t buffer[kBufLen];

  long bytes = 2 * cfg.duration * cfg.rate;
  for (long i = 0; i < bytes; i += kBufLen) {
    int wanted = bytes - i;
    if (wanted > kBufLen) {
      wanted = kBufLen;
    }
    generate(cfg, buffer, wanted);
    cout.write(reinterpret_cast<char*>(buffer), wanted);
  }
}
