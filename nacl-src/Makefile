VALID_TOOLCHAINS := pnacl

include $(NACL_SDK_ROOT)/tools/common.mk

TARGET = radio-decoder
LIBS = ppapi_cpp ppapi

CFLAGS = -Wall -std=gnu++11
SOURCES = decode-module.cc dsp.cc am_decoder.cc nbfm_decoder.cc wbfm_decoder.cc

$(foreach src,$(SOURCES),$(eval $(call COMPILE_RULE,$(src),$(CFLAGS))))

ifneq (,$(or $(findstring pnacl,$(TOOLCHAIN)),$(findstring Release,$(CONFIG))))
$(eval $(call LINK_RULE,$(TARGET)_unstripped,$(SOURCES),$(LIBS),$(DEPS)))
$(eval $(call STRIP_RULE,$(TARGET),$(TARGET)_unstripped))
else
$(eval $(call LINK_RULE,$(TARGET),$(SOURCES),$(LIBS),$(DEPS)))
endif

$(eval $(call NMF_RULE,$(TARGET),))

