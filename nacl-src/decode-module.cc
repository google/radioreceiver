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
#include "decoder.h"
#include "am_decoder.h"
#include "nbfm_decoder.h"
#include "wbfm_decoder.h"

using namespace std;

namespace radioreceiver {

static const int kInRate = 1024000;
static const int kOutRate = 48000;

DecodeInstance::DecodeInstance(PP_Instance instance)
    : pp::Instance(instance), decoder_(new WBFMDecoder(kInRate, kOutRate)) {}

DecodeInstance::~DecodeInstance() {
  delete decoder_;
}

void DecodeInstance::HandleMessage(const pp::Var& message) {
  if (!message.is_array()) {
    return;
  }

  const pp::VarArray& arr = static_cast<pp::VarArray>(message);
  if (!arr.Get(0).is_int()) {
    return;
  }

  switch(arr.Get(0).AsInt()) {
    case 1:
      setMode(arr);
      break;
    default:
      process(arr);
  }
}

void DecodeInstance::setMode(const pp::VarArray& arr) {
  if (!arr.Get(1).is_dictionary()) {
    return;
  }

  pp::VarDictionary mode(arr.Get(1));
  string modulation("");
  if (mode.Get("modulation").is_string()) {
    modulation = mode.Get("modulation").AsString();
  }

  delete decoder_;
  if (modulation == "AM") {
    pp::Var bandwidth = mode.Get("bandwidth");
    decoder_ = new AMDecoder(kInRate, kOutRate, bandwidth.is_int() ? bandwidth.AsInt() : 10000);
  } else if (modulation == "NBFM") {
    pp::Var maxf = mode.Get("maxF");
    decoder_ = new NBFMDecoder(kInRate, kOutRate, maxf.is_int() ? maxf.AsInt() : 8000);
  } else {
    decoder_ = new WBFMDecoder(kInRate, kOutRate);
  }
}

void DecodeInstance::process(const pp::VarArray& arr) {
  if (!arr.Get(1).is_array_buffer()) {
    return;
  }
  if (!arr.Get(2).is_bool()) {
    return;
  }

  const pp::VarArrayBuffer& constBuffer = static_cast<pp::VarArrayBuffer>(
      arr.Get(1));
  pp::VarArrayBuffer& buffer = const_cast<pp::VarArrayBuffer&>(constBuffer);
  bool inStereo = arr.Get(2).AsBool();

  uint8_t* buf = reinterpret_cast<uint8_t*>(buffer.Map());
  int bufLen = buffer.ByteLength();
  StereoAudio audio = decoder_->decode(samplesFromUint8(buf, bufLen), inStereo);
  buffer.Unmap();

  int bufSize = sizeof(float) * audio.left.size();
  pp::VarArrayBuffer left(bufSize);
  pp::VarArrayBuffer right(bufSize);
  memcpy(left.Map(), audio.left.data(), bufSize);
  memcpy(right.Map(), audio.right.data(), bufSize);
  left.Unmap();
  right.Unmap();

  pp::VarDictionary dict;
  if (arr.Get(3).is_dictionary()) {
    dict = arr.Get(3);
  }
  dict.Set(pp::Var("rate"), pp::Var(kOutRate));
  dict.Set(pp::Var("stereo"), pp::Var(audio.inStereo));
  dict.Set(pp::Var("carrier"), pp::Var(audio.carrier));

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
