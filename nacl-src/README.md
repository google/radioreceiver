# NaCl implementation of the DSP code (currently unused)

I started Radio Receiver as an experiment to see if I could grab samples from a USB device, demodulate radio signals, and produce audio in real time, in 100% JavaScript, on the old ChromeBook I have at home.

The initial experiment was successful, but as I wanted to add more features, it felt like I was running against the limits of what I could do with JavaScript, so I started a reimplementation in C++ for NaCl.

However, in the meantime I figured out a couple of ways to extract some more performance from the JavaScript code, so I'm still working primarily on that.

So, for now I'm keeping this C++ code here, because it's useful to try out algorithms and formulas, and it may become actually necessary in the future. And, even if I never get to use it, at least I'll have learnt NaCl and relearnt C++ :-)
