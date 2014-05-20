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
 * Module and instance initialization for the decoder.
 */

#include <cstring>
#include <memory>
#include <stdint.h>

#include <ppapi/cpp/module.h>
#include <ppapi/cpp/var.h>
#include <ppapi/cpp/var_array.h>
#include <ppapi/cpp/var_array_buffer.h>
#include <ppapi/cpp/var_dictionary.h>

#include "decode-module.h"

using namespace std;

namespace radioreceiver {

void DecodeInstance::HandleMessage(const pp::Var& message) {
  if (!message.is_array()) {
    return;
  }

  const pp::VarArray& arr = static_cast<pp::VarArray>(message);
  if (!arr.Get(0).is_array_buffer()) {
    return;
  }
  if (!arr.Get(1).is_bool()) {
    return;
  }

  const pp::VarArrayBuffer& constBuffer = static_cast<pp::VarArrayBuffer>(arr.Get(0));
  pp::VarArrayBuffer& buffer = const_cast<pp::VarArrayBuffer&>(constBuffer);
  bool inStereo = arr.Get(1).AsBool();

  uint8_t* buf = reinterpret_cast<uint8_t*>(buffer.Map());
  int bufLen = buffer.ByteLength();

  unique_ptr<Samples> leftAudio;
  unique_ptr<Samples> rightAudio;
  decoder_.process(buf, bufLen, inStereo, leftAudio, rightAudio);

  buffer.Unmap();

  int rate = leftAudio->getRate();
  bool isStereo = false;
  int bufSize = sizeof(float) * leftAudio->getData().size();
  pp::VarArrayBuffer left(bufSize);
  pp::VarArrayBuffer right(bufSize);
  memcpy(left.Map(), leftAudio->getData().data(), bufSize);
  if (rightAudio) {
    isStereo = true;
    memcpy(right.Map(), rightAudio->getData().data(), bufSize);
  } else {
    memcpy(right.Map(), leftAudio->getData().data(), bufSize);
  }

  pp::VarDictionary dict;
  if (arr.Get(2).is_dictionary()) {
    dict = arr.Get(2);
  }
  dict.Set(pp::Var("rate"), pp::Var(rate));
  dict.Set(pp::Var("stereo"), pp::Var(isStereo));

  pp::VarArray resp;
  resp.Set(0, left);
  resp.Set(1, right);
  resp.Set(2, dict);

  PostMessage(resp);
}

}  // namespace radioreceiver

namespace pp {

Module* CreateModule() {
  return new radioreceiver::DecodeModule();
}

}  // namespace pp

