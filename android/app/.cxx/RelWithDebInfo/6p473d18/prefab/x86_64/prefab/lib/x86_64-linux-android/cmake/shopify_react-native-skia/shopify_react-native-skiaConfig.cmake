if(NOT TARGET shopify_react-native-skia::rnskia)
add_library(shopify_react-native-skia::rnskia SHARED IMPORTED)
set_target_properties(shopify_react-native-skia::rnskia PROPERTIES
    IMPORTED_LOCATION "C:/Ryan/Projects/Lucid/node_modules/@shopify/react-native-skia/android/build/intermediates/cxx/RelWithDebInfo/491u2j6n/obj/x86_64/librnskia.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Ryan/Projects/Lucid/node_modules/@shopify/react-native-skia/android/build/headers/rnskia"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

