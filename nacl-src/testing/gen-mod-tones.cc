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
#include <random>
#include <string>

using namespace std;

const int kBufLen = 65536;
const double k2Pi = 2 * 3.14159265358979;

const char *kMods[] = { "AM", "WBFM", "NBFM", 0 };

struct Config {
  int mod;
  bool stereo;
  int maxf;
  int leftFreq;
  int rightFreq;
  double leftPhase;
  double rightPhase;
  double carrierPhase;
  int rate;
  double duration;
  double leftGain;
  double rightGain;
  double carrierLevel;
  double noise;
};

void generate(Config cfg, uint8_t* buffer, int length) {
  default_random_engine engine;
  uniform_real_distribution<double> noise(-1.0, 1.0);
  static double phase = cfg.carrierPhase;
  static int sample = 0;
  int pilotFreq = 19000;
  for (int i = 0; i < length / 2; ++i) {
    ++sample;
    double sampleI;
    double sampleQ;
    double samplePre = cfg.leftGain *
      sin(cfg.leftPhase + k2Pi * cfg.leftFreq * sample / cfg.rate);
    switch (cfg.mod) {
    case 0:
      sampleI = cos(cfg.carrierPhase) * (1 + samplePre) / 4;
      sampleQ = sin(cfg.carrierPhase) * (1 + samplePre) / 4;
      break;
    case 1:
      if (cfg.stereo) {
	double sampleLeft = cfg.leftGain *
	  sin(cfg.leftPhase + k2Pi * cfg.leftFreq * sample / cfg.rate);
	double sampleRight = cfg.rightGain *
	  sin(cfg.rightPhase + k2Pi * cfg.rightFreq * sample / cfg.rate);
	double samplePilot = sin(k2Pi * pilotFreq * sample / cfg.rate);
	double sampleSum = sampleLeft + sampleRight;
	double sampleDiff = sampleLeft - sampleRight;
	double sampleTop = sampleDiff *
          sin(k2Pi * 2 * pilotFreq * sample / cfg.rate);
	samplePre = sampleSum * .45 + samplePilot * .1 + sampleTop * .45;
      }
    case 2:
      phase += k2Pi * samplePre * cfg.maxf / cfg.rate;
      sampleI = cos(phase);
      sampleQ = sin(phase);
      break;
    }
    sampleI *= cfg.carrierLevel;
    sampleQ *= cfg.carrierLevel;
    if (cfg.noise > 0) {
      double buzz = noise(engine);
      sampleI = sampleI * (1 - cfg.noise) + buzz * cfg.noise;
      sampleQ = sampleQ * (1 - cfg.noise) + buzz * cfg.noise;
    }
    buffer[2 * i] = 1 + 254 * (sampleI + 1) / 2;
    buffer[2 * i + 1] = 1 + 254 * (sampleQ + 1) / 2;
  }
}

int main(int argc, char* argv[]) {
  Config cfg { 1, true, 0, 997, 1499, 0, 0, 0, 1024000, 1.0, 1, 1, 1, 0 };

  for (int i = 1; i < argc; ++i) {
    if (string("-mod") == argv[i]) {
      string modName = string(argv[++i]);
      int mod = -1;
      for (int i = 0; kMods[i]; ++i) {
	if (modName == string(kMods[i])) {
	  mod = i;
	}
      }
      if (mod == -1) {
	cerr << "Unknown modulation: " << modName << endl;
	return 1;
      }
      cfg.mod = mod;
      if (cfg.maxf == 0) {
	cfg.maxf = mod == 1 ? 75000 : 10000;
      }
    } else if (string("-maxf") == argv[i]) {
      cfg.maxf = stoi(argv[++i]);
      cfg.mod = 2;
    } else if (string("-freq") == argv[i]) {
      cfg.leftFreq = stoi(argv[++i]);
      cfg.stereo = false;
    } else if (string("-left") == argv[i]) {
      cfg.leftFreq = stoi(argv[++i]);
    } else if (string("-right") == argv[i]) {
      cfg.rightFreq = stoi(argv[++i]);
    } else if (string("-leftphase") == argv[i]) {
      cfg.leftPhase = stod(argv[++i]);
    } else if (string("-rightphase") == argv[i]) {
      cfg.rightPhase = stod(argv[++i]);
    } else if (string("-carrierphase") == argv[i]) {
      cfg.carrierPhase = stod(argv[++i]);
    } else if (string("-mono") == argv[i]) {
      cfg.stereo = false;
    } else if (string("-rate") == argv[i]) {
      cfg.rate = stoi(argv[++i]);
    } else if (string("-duration") == argv[i]) {
      cfg.duration = stof(argv[++i]);
    } else if (string("-leftgain") == argv[i]) {
      cfg.leftGain = stod(argv[++i]);
    } else if (string("-rightgain") == argv[i]) {
      cfg.rightGain = stod(argv[++i]);
    } else if (string("-carrierlevel") == argv[i]) {
      cfg.carrierLevel = stod(argv[++i]);
    } else if (string("-noise") == argv[i]) {
      cfg.noise = stod(argv[++i]);
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
