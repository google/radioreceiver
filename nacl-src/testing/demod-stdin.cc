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
 * Demodulates a captured signal and writes the demodulated signal as a
 * raw 16-bit signed little-endian stereo stream.
 */
#include <iostream>
#include <string>

#include "dsp.h"
#include "am_decoder.h"
#include "nbfm_decoder.h"
#include "wbfm_decoder.h"

using namespace radioreceiver;
using namespace std;

const char *kMods[] = { "AM", "WBFM", "NBFM", 0 };

struct Config {
  int mod;
  bool stereo;
  int maxf;
  int bandwidth;
  int blockSize;
  int inRate;
  int outRate;
};

Decoder* makeDecoder(const Config& cfg) {
  switch (cfg.mod) {
  case 0:
    return new AMDecoder(cfg.inRate, cfg.outRate, cfg.bandwidth);
  case 1:
    return new WBFMDecoder(cfg.inRate, cfg.outRate);
  case 2:
    return new NBFMDecoder(cfg.inRate, cfg.outRate, cfg.maxf);
  }
}

int main(int argc, char* argv[]) {
  Config cfg { 1, true, 10000, 10000, 65536, 1024000, 48000 };

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
    } else if (string("-maxf") == argv[i]) {
      cfg.maxf = stoi(argv[++i]);
    } else if (string("-bandwidth") == argv[i]) {
      cfg.bandwidth = stoi(argv[++i]);
    } else if (string("-mono") == argv[i]) {
      cfg.stereo = false;
    } else if (string("-blocksize") == argv[i]) {
      cfg.blockSize = stoi(argv[++i]);
      cfg.blockSize -= (cfg.blockSize % 2);
    } else if (string("-inrate") == argv[i]) {
      cfg.inRate = stoi(argv[++i]);
    } else if (string("-outrate") == argv[i]) {
      cfg.outRate = stoi(argv[++i]);
    } else {
      cerr << "Unknown flag: " << argv[i] << endl;
      return 1;
    }
  }

  char outBlock[4];
  char* buffer = new char[cfg.blockSize];
  Decoder* decoder = makeDecoder(cfg);
  while (!cin.eof()) {
    cin.read(buffer, cfg.blockSize);
    int read = cin.gcount();
    StereoAudio audio =
      decoder->decode(samplesFromUint8(reinterpret_cast<uint8_t*>(buffer),
				       read),
		      cfg.stereo);
    for (int i = 0; i < audio.left.size(); ++i) {
      int left = audio.left[i] * 32767;
      if (left > 32767) left = 32767;
      if (left < -32767) left = -32767;
      outBlock[0] = left & 0xff;
      outBlock[1] = (left >> 8) & 0xff;
      int right = audio.right[i] * 32767;
      if (right > 32767) right = 32767;
      if (right < -32767) right = -32767;
      outBlock[2] = right & 0xff;
      outBlock[3] = (right >> 8) & 0xff;
      cout.write(outBlock, 4);
    }
  }
}
