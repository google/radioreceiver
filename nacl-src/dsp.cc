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
 * DSP functions and operations.
 */

#include <algorithm>
#include <cassert>
#include <cmath>
#include <memory>
#include <stdint.h>
#include <vector>

#include "dsp.h"

using namespace std;

namespace radioreceiver {

const double k2Pi = 2 * 3.14159265358979;

vector<float> getLowPassFIRCoeffs(int sampleRate, float halfAmplFreq, int length) {
  length += (length + 1) % 2;
  float freq = halfAmplFreq / sampleRate;
  int center = length / 2;
  float sum = 0;
  vector<float> coefficients(length);
  for (int i = 0; i < length; ++i) {
    float val;
    if (i == center) {
      val = k2Pi * freq;
    } else {
      float angle = k2Pi * (i + 1) / (length + 1);
      val = sin(k2Pi * freq * (i - center)) / (i - center);
      val *= 0.42 - 0.5 * cos(angle) + 0.08 * cos(2 * angle);
    }
    sum += val;
    coefficients[i] = val;
  }
  for (int i = 0; i < length; ++i) {
    coefficients[i] /= sum;
  }
  return coefficients;
}

unique_ptr<Samples> samplesFromUint8(uint8_t* buffer, int length, int rate) {
  vector<float> out(length);
  for (int i = 0; i < length; ++i) {
    out[i] = buffer[i] / 128.0 - 1;
  }
  return unique_ptr<Samples>(new Samples(out, rate));
}


FIRFilter::FIRFilter(const vector<float>& coefficients, int step)
    : coefficients_(coefficients),
      curSamples_(coefficients.size() * step, 0),
      step_(step), offset_(coefficients.size() * step) {}

void FIRFilter::loadSamples(const Samples& samples) {
  int fullLen = samples.getData().size() + offset_;
  move_backward(curSamples_.end() - offset_, curSamples_.end(), curSamples_.begin());
  if (curSamples_.size() < fullLen) {
    curSamples_.resize(fullLen);
  }
  copy(samples.getData().begin(), samples.getData().end(), curSamples_.begin() + offset_);
}

float FIRFilter::get(int index) {
  float out = 0;
  int sampleOff = index + offset_;
  for (int i = coefficients_.size() - 1; i >= 0; --i) {
    out += coefficients_[i] * curSamples_[sampleOff - i * step_];
  }
  return out;
}


Downsampler::Downsampler(int inRate, int outRate, const vector<float>& coefficients)
    : filter_(coefficients, 1), rateMul_(inRate / outRate), outRate_(outRate) {}

unique_ptr<Samples> Downsampler::downsample(const Samples& samples) {
  filter_.loadSamples(samples);
  int outLen = samples.getData().size() / rateMul_;
  vector<float> out(outLen);
  float readFrom = 0;
  for (int i = 0; i < outLen; ++i, readFrom += rateMul_) {
    out[i] = filter_.get((int) readFrom);
  }
  return unique_ptr<Samples>(new Samples(out, outRate_));
}


IQDownsampler::IQDownsampler(int inRate, int outRate, const vector<float>& coefficients)
    : filter_(coefficients, 2), rateMul_(inRate / outRate), outRate_(outRate) {}

unique_ptr<SamplesIQ> IQDownsampler::downsample(const Samples& samples) {
  int numSamples = samples.getData().size() / (2 * rateMul_);
  filter_.loadSamples(samples);
  vector<float> outI(numSamples);
  vector<float> outQ(numSamples);
  float readFrom = 0;
  for (int i = 0; i < numSamples; ++i, readFrom += rateMul_) {
    int idx = 2 * readFrom;
    outI[i] = filter_.get(idx);
    outQ[i] = filter_.get(idx + 1);
  }
  return unique_ptr<SamplesIQ>(new SamplesIQ(Samples(outI, outRate_), Samples(outQ, outRate_)));
}


const float FMDemodulator::kGain = 1;
const float FMDemodulator::kMaxFFactor = 0.8;


FMDemodulator::FMDemodulator(int inRate, int outRate, int maxF)
  : outRate_(outRate), amplConv_(outRate * kGain / (k2Pi * maxF)),
    downsampler_(inRate, outRate, getLowPassFIRCoeffs(inRate, maxF * kMaxFFactor, kFilterLen)),
    lI_(0), lQ_(0) {}

unique_ptr<Samples> FMDemodulator::demodulateTuned(const Samples& samples) {
  unique_ptr<SamplesIQ> iqSamples(downsampler_.downsample(samples));
  vector<float> I = iqSamples->first.getData();
  vector<float> Q = iqSamples->second.getData();
  int outLen = I.size();
  vector<float> out(outLen);
  for (int i = 0; i < outLen; ++i) {
    float divisor = (I[i] * I[i] + Q[i] * Q[i]);
    float deltaAngle = divisor == 0 ? 0 : ((I[i] * (Q[i] - lQ_) - Q[i]* (I[i] - lI_)) / divisor);
    out[i] = (deltaAngle + deltaAngle * deltaAngle * deltaAngle / 3) * amplConv_;
    lI_ = I[i];
    lQ_ = Q[i];
  }
  return unique_ptr<Samples>(new Samples(out, outRate_));
}


ExpAverage::ExpAverage(int weight, bool calcStd)
    : weight_(weight), calcStd_(calcStd), avg_(0), std_(0) {}

float ExpAverage::add(float value) {
  avg_ = (weight_ * avg_ + value) / (weight_ + 1);
  if (calcStd_) {
    float dev = value - avg_;
    std_ = (weight_ * std_ + dev * dev) / (weight_ + 1);
  }
  return avg_;
}

StereoSeparator::StereoSeparator(int sampleRate, int pilotFreq)
    : sin_(0), cos_(1), iavg_(9999), qavg_(9999), cavg_(49999, true) {
  for (int i = 0; i < 8001; ++i) {
    float freq = (pilotFreq + i / 100 - 40) * k2Pi / sampleRate;
    sinTable_[i] = sin(freq);
    cosTable_[i] = cos(freq);
  }      
}

unique_ptr<StereoSignal> StereoSeparator::separate(const Samples& samples) {
  vector<float> in = samples.getData();
  int outLen = in.size();
  vector<float> out(outLen);
  for (int i = 0; i < outLen; ++i) {
    float hdev = iavg_.add(in[i] * sin_);
    float vdev = qavg_.add(in[i] * cos_);
    out[i] = in[i] * sin_ * cos_ * 2;
    float corr;
    if (hdev > 0) {
      corr = fmaxf(-4, fminf(4, vdev / hdev));
    } else {
      corr = vdev == 0 ? 0 : (vdev > 0 ? 4 : -4);
    }
    int idx = roundf((corr + 4) * 1000);
    float newSin = sin_ * cosTable_[idx] + cos_ * sinTable_[idx];
    cos_ = cos_ * cosTable_[idx] - sin_ * sinTable_[idx];
    sin_ = newSin;
    cavg_.add(corr * 10);
  }
  return unique_ptr<StereoSignal>(new StereoSignal(cavg_.getStd(), Samples(out, samples.getRate())));
}


Deemphasizer::Deemphasizer(int sampleRate, int timeConstant_uS)
  : mult_(exp(-1e6 / (timeConstant_uS * sampleRate))), val_(0) {}

/**
 * Deemphasizes the given samples in place.
 * @param samples The samples to deemphasize.
 */
void Deemphasizer::inPlace(const Samples& samples) {
  vector<float> data = samples.getData();
  for (int i = 0; i < samples.getData().size(); ++i) {
    val_ = (1 - mult_) * data[i] + mult_ * val_;
    data[i] = val_;
  }
}

}  // namespace radioreceiver

