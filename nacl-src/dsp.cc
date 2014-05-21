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

vector<float> getLowPassFIRCoeffs(int sampleRate, float halfAmplFreq,
                                  int length) {
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

Samples samplesFromUint8(uint8_t* buffer, int length, int rate) {
  Samples out(length);
  for (int i = 0; i < length; ++i) {
    out[i] = buffer[i] / 128.0 - 1;
  }
  return out;
}


FIRFilter::FIRFilter(const vector<float>& coefficients, int step)
    : coefficients_(coefficients),
      curSamples_(coefficients.size() * step, 0),
      step_(step), offset_(coefficients.size() * step) {}

void FIRFilter::loadSamples(const Samples& samples) {
  int fullLen = samples.size() + offset_;
  Samples newSamples(fullLen);
  auto newStart = copy(curSamples_.end() - offset_, curSamples_.end(),
                       newSamples.begin());
  copy(samples.begin(), samples.end(), newStart);
  curSamples_ = newSamples;
}

float FIRFilter::get(int index) {
  float out = 0;
  int sampleOff = index + offset_;
  for (int i = coefficients_.size() - 1; i >= 0; --i) {
    out += coefficients_[i] * curSamples_[sampleOff - i * step_];
  }
  return out;
}


Downsampler::Downsampler(int inRate, int outRate,
                         const vector<float>& coefs)
    : filter_(coefs, 1), rateMul_(inRate / outRate) {}

Samples Downsampler::downsample(const Samples& samples) {
  filter_.loadSamples(samples);
  int outLen = samples.size() / rateMul_;
  Samples out(outLen);
  float readFrom = 0;
  for (int i = 0; i < outLen; ++i, readFrom += rateMul_) {
    out[i] = filter_.get((int) readFrom);
  }
  return out;
}


IQDownsampler::IQDownsampler(int inRate, int outRate,
                             const vector<float>& coefs)
    : filter_(coefs, 2), rateMul_(inRate / outRate) {}

SamplesIQ IQDownsampler::downsample(const Samples& samples) {
  int numSamples = samples.size() / (2 * rateMul_);
  filter_.loadSamples(samples);
  Samples outI(numSamples);
  Samples outQ(numSamples);
  float readFrom = 0;
  for (int i = 0; i < numSamples; ++i, readFrom += rateMul_) {
    int idx = 2 * readFrom;
    outI[i] = filter_.get(idx);
    outQ[i] = filter_.get(idx + 1);
  }
  return SamplesIQ{outI, outQ};
}


const float FMDemodulator::kGain = 1;
const float FMDemodulator::kMaxFFactor = 0.8;

FMDemodulator::FMDemodulator(int inRate, int outRate, int maxF)
  : amplConv_(outRate * kGain / (k2Pi * maxF)),
    downsampler_(inRate, outRate,
                 getLowPassFIRCoeffs(inRate, maxF * kMaxFFactor, kFilterLen)),
    lI_(0), lQ_(0) {}

Samples FMDemodulator::demodulateTuned(const Samples& samples) {
  SamplesIQ iqSamples(downsampler_.downsample(samples));
  Samples& I = iqSamples.I;
  Samples& Q = iqSamples.Q;
  int outLen = I.size();
  Samples out(outLen);
  for (int i = 0; i < outLen; ++i) {
    float divisor = (I[i] * I[i] + Q[i] * Q[i]);
    float deltaAngle = divisor == 0
        ? 0
        : ((I[i] * (Q[i] - lQ_) - Q[i]* (I[i] - lI_)) / divisor);
    out[i] = deltaAngle * (1 + deltaAngle * deltaAngle / 3) * amplConv_;
    lI_ = I[i];
    lQ_ = Q[i];
  }
  return out;
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

StereoSignal StereoSeparator::separate(const Samples& samples) {
  Samples out(samples);
  for (int i = 0; i < out.size(); ++i) {
    float hdev = iavg_.add(out[i] * sin_);
    float vdev = qavg_.add(out[i] * cos_);
    out[i] *= sin_ * cos_ * 2;
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
  return StereoSignal(cavg_.getStd(), out);
}


Deemphasizer::Deemphasizer(int sampleRate, int timeConstant_uS)
  : mult_(exp(-1e6 / (timeConstant_uS * sampleRate))), val_(0) {}

void Deemphasizer::inPlace(Samples& samples) {
  for (int i = 0; i < samples.size(); ++i) {
    val_ = (1 - mult_) * samples[i] + mult_ * val_;
    samples[i] = val_;
  }
}

}  // namespace radioreceiver
