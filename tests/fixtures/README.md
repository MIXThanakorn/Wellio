`example.heic` is the example image from the libheif project, used only to verify local HEIC decoding and image editing in browser tests.

Source: https://github.com/strukturag/libheif/blob/master/examples/example.heic
Project licensing: https://github.com/strukturag/libheif/blob/master/COPYING

The production application does not ship this fixture. Its HEIC decoder is `heic-to@1.6.7`, loaded in a worker only when the browser cannot decode a HEIC image. The package license is included at `/licenses/heic-to.txt`; source is available at https://github.com/hoppergee/heic-to.
