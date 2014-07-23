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
#include <cstring>
#include <memory>
#include <numeric>
#include <stdint.h>
#include <vector>

#include "dsp.h"

using namespace std;

namespace radioreceiver {

const double kPi = 3.141592653989793238;
const double k2Pi = 2 * kPi;
const double kPi2 = kPi / 2;

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

Samples samplesFromUint8(uint8_t* buffer, int length) {
  Samples out(length);
  for (int i = 0; i < length; ++i) {
    out[i] = buffer[i] / 128.0 - 1;
  }
  return out;
}


FIRFilter::FIRFilter(const vector<float>& coefficients, int step)
    : coefficients_(coefficients),
      curSamples_((coefficients.size() - 1) * step, 0),
      step_(step), offset_((coefficients.size() - 1) * step) {
  reverse(coefficients_.begin(), coefficients_.end());
}

void FIRFilter::loadSamples(const Samples& samples) {
  int fullLen = samples.size() + offset_;
  float* curArr = curSamples_.data();
  float* endOfCur = curArr + curSamples_.size() - offset_;
  memmove(curArr, endOfCur, offset_ * sizeof(float));
  if (fullLen != curSamples_.size()) {
    curSamples_.resize(fullLen);
    curArr = curSamples_.data();
  }
  memmove(curArr + offset_, samples.data(), samples.size() * sizeof(float));
}

float FIRFilter::get(int index) {
  float out = 0;
  for (int ic = 0, is = index, sz = coefficients_.size(); ic < sz;
       ++ic, is += step_) {
    out += coefficients_[ic] * curSamples_[is];
  }
  return out;
}


Downsampler::Downsampler(int inRate, int outRate,
                         const vector<float>& coefs)
    : filter_(coefs, 1), rateMul_((float) inRate / outRate) {}

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
    : filter_(coefs, 2), rateMul_((float) inRate / outRate) {}

SamplesIQ IQDownsampler::downsample(const Samples& samples) {
  int numSamples = samples.size() / (2 * rateMul_);
  filter_.loadSamples(samples);
  SamplesIQ out{Samples(numSamples), Samples(numSamples)};
  float readFrom = 0;
  for (int i = 0; i < numSamples; ++i, readFrom += rateMul_) {
    int idx = 2 * ((int) readFrom);
    out.I[i] = filter_.get(idx);
    out.Q[i] = filter_.get(idx + 1);
  }
  return out;
}


AMDemodulator::AMDemodulator(int inRate, int outRate, float filterFreq,
                             int kernelLen)
    : downsampler_(inRate, outRate,
                   getLowPassFIRCoeffs(inRate, filterFreq, kernelLen)) {}

Samples AMDemodulator::demodulateTuned(const Samples& samples) {
  SamplesIQ iqSamples(downsampler_.downsample(samples));
  int outLen = iqSamples.I.size();
  float iAvg = accumulate(iqSamples.I.begin(), iqSamples.I.end(), 0) / outLen;
  float qAvg = accumulate(iqSamples.Q.begin(), iqSamples.Q.end(), 0) / outLen;
  Samples out(outLen);
  float sigSqrSum = 0;
  float sigSum = 0;
  for (int i = 0; i < outLen; ++i) {
    float I = iqSamples.I[i] - iAvg;
    float Q = iqSamples.Q[i] - qAvg;
    float power = I * I + Q * Q;
    float ampl = sqrt(power);
    out[i] = ampl;
    sigSum += ampl;
    sigSqrSum += power;
  }
  float halfPoint = sigSum / outLen;
  for (auto &o : out) {
    o = (o - halfPoint) / halfPoint;
  }
  hasCarrier_ = sigSqrSum > (0.002 * outLen);
  return out;
}

bool AMDemodulator::hasCarrier() {
  return hasCarrier_;
}


static float myatan2(float y, float x) {
  float sgn = 1;
  if (y < 0) {
    sgn *= -1;
    y *= -1;
  }
  float ang = 0;
  float div;
  if (x == y) {
    div = 1;
  } else if (x > y) {
    div = y / x;
  } else {
    ang = -kPi2;
    div = x / y;
    sgn *= -1;
  }
  ang +=
    div /
    (0.98419158358617365
     + div * (0.093485702629671305
	      + div * 0.19556307900617517));
  return sgn * ang;
}


FMDemodulator::FMDemodulator(int inRate, int outRate, int maxF,
                             float filterFreq, int kernelLen)
  : amplConv_(outRate / (k2Pi * maxF)),
    downsampler_(inRate, outRate,
                 getLowPassFIRCoeffs(inRate, filterFreq, kernelLen)),
    lI_(0), lQ_(0) {}

Samples FMDemodulator::demodulateTuned(const Samples& samples) {
  SamplesIQ iqSamples(downsampler_.downsample(samples));
  int outLen = iqSamples.I.size();
  Samples out(outLen);
  float sigSqrSum = 0;
  for (int i = 0; i < outLen; ++i) {
    float I = iqSamples.I[i];
    float Q = iqSamples.Q[i];
    float real = lI_ * I + lQ_ * Q;
    float imag = lI_ * Q - I * lQ_;
    out[i] = myatan2(imag, real) * amplConv_;
    lI_ = I;
    lQ_ = Q;
    sigSqrSum += lI_ * lI_;
  }
  hasCarrier_ = sigSqrSum > (0.002 * outLen);
  return out;
}

bool FMDemodulator::hasCarrier() {
  return hasCarrier_;
}


class StereoSeparator::ExpAverage {
  float weight_;
  float avg_;

 public:
  ExpAverage(int weight) : weight_(weight), avg_(0) {}

  float add(float value) {
    avg_ = (weight_ * avg_ + value) / (weight_ + 1);
    return avg_;
  }

  float get() { return avg_; }
};

StereoSeparator::StereoSeparator(int sampleRate, int pilotFreq)
    : sin_(0), cos_(1),
      iavg_(new ExpAverage(sampleRate * 0.03)),
      qavg_(new ExpAverage(sampleRate * 0.03)),
      cavg_(new ExpAverage(sampleRate * 0.15)) {
  for (int i = 0; i < 8001; ++i) {
    float freq = (pilotFreq + i / 100 - 40) * k2Pi / sampleRate;
    sinTable_[i] = sin(freq);
    cosTable_[i] = cos(freq);
  }
}

StereoSeparator::~StereoSeparator() {}

const float StereoSeparator::kCorrThres = 4;

StereoSignal StereoSeparator::separate(const Samples& samples) {
  Samples out(samples);
  for (int i = 0, sz = out.size(); i < sz; ++i) {
    float hdev = qavg_->add(out[i] * cos_);
    float vdev = iavg_->add(out[i] * sin_);
    out[i] *= sin_ * cos_ * 2;
    float corr;
    if (vdev > 0) {
      corr = fmaxf(-4, fminf(4, hdev / vdev));
    } else {
      corr = hdev == 0 ? 0 : hdev > 0 ? 4 : -4;
    }
    int idx = roundf((corr + 4) * 1000);
    float newSin = sin_ * cosTable_[idx] + cos_ * sinTable_[idx];
    cos_ = cos_ * cosTable_[idx] - sin_ * sinTable_[idx];
    sin_ = newSin;
    cavg_->add(corr * corr);
  }

  return StereoSignal{cavg_->get() < kCorrThres, out};
}


Deemphasizer::Deemphasizer(int sampleRate, int timeConstant_uS)
  : mult_(exp(-1e6 / (timeConstant_uS * sampleRate))), val_(0) {}

void Deemphasizer::inPlace(Samples& samples) {
  for (int i = 0, sz = samples.size(); i < sz; ++i) {
    val_ = (1 - mult_) * samples[i] + mult_ * val_;
    samples[i] = val_;
  }
}

}  // namespace radioreceiver
