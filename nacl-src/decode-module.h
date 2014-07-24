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

#ifndef DECODE_MODULE_H_
#define DECODE_MODULE_H_

#include <ppapi/cpp/instance.h>
#include <ppapi/cpp/module.h>

#include "wbfm_decoder.h"

namespace radioreceiver {

class DecodeInstance : public pp::Instance {
  Decoder* decoder_;

 public:
  explicit DecodeInstance(PP_Instance instance);
  virtual ~DecodeInstance();

  virtual void HandleMessage(const pp::Var& message);
  void process(const pp::VarArray& arr);
  void setMode(const pp::VarArray& arr);
};

class DecodeModule : public pp::Module {
 public:
  DecodeModule() : pp::Module() {}
  virtual ~DecodeModule() {}

  virtual pp::Instance* CreateInstance(PP_Instance instance) {
    return new DecodeInstance(instance);
  }
};

}  // namespace radioreceiver

#endif  // DECODE_MODULE_H_
