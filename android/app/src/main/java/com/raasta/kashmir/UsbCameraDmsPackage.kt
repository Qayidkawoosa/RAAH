package com.raasta.kashmir

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * UsbCameraDmsPackage
 * Registers UsbCameraDmsModule and UsbCameraPreviewViewManager with the React Native bridge.
 */
class UsbCameraDmsPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(UsbCameraDmsModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(UsbCameraPreviewViewManager())
    }
}
