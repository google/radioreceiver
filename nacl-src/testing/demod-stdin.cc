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
#include "decoder.h"

using namespace radioreceiver;
using namespace std;

const int kBufLen = 65536;
const float k2Pi = 2 * 3.14159265358979;

struct Config {
  bool stereo;
  int blockSize;
};

int main(int argc, char* argv[]) {
  Config cfg { true, 65536 };

  for (int i = 1; i < argc; ++i) {
    if (string("-mono") == argv[i]) {
      cfg.stereo = false;
    } else if (string("-blocksize") == argv[i]) {
      cfg.blockSize = stoi(argv[++i]);
      cfg.blockSize -= (cfg.blockSize % 2);
    } else {
      cerr << "Unknown flag: " << argv[i] << endl;
      return 1;
    }
  }

  char outBlock[4];
  char* buffer = new char[cfg.blockSize];
  Decoder decoder;
  while (!cin.eof()) {
    cin.read(buffer, cfg.blockSize);
    int read = cin.gcount();
    StereoAudio audio = decoder.process(
        reinterpret_cast<uint8_t*>(buffer), read, cfg.stereo);
    for (int i = 0; i < audio.left.getData().size(); ++i) {
      int left = (audio.left.getData()[i] * 32767);
      int right = (audio.right.getData()[i] * 32767);
      outBlock[0] = left & 0xff;
      outBlock[1] = (left >> 8) & 0xff;
      outBlock[2] = right & 0xff;
      outBlock[3] = (right >> 8) & 0xff;
      cout.write(outBlock, 4);
    }
  }
}
