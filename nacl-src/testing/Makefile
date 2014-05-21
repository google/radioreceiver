CPPFLAGS=-std=c++0x -I$(PWD)/.. -g

all:	gen-mod-tones demod-stdin

gen-mod-tones:	gen-mod-tones.cc
demod-stdin:	demod-stdin.cc ../dsp.cc ../wbfm_decoder.cc

.PHONY:	clean
clean:
	rm -f gen-mod-tones demod-stdin
