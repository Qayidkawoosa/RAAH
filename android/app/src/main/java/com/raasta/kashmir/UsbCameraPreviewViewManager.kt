package com.raasta.kashmir

import android.graphics.SurfaceTexture
import android.util.Log
import android.view.Surface
import android.view.TextureView
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * UsbCameraPreviewViewManager
 * 
 * Exposes a hardware-accelerated TextureView to React Native as <UsbCameraPreviewView />.
 * Renders the external USB/OTG webcam video stream or built-in camera preview directly
 * on the driver cockpit screen.
 */
class UsbCameraPreviewViewManager : SimpleViewManager<TextureView>() {

    companion object {
        const val REACT_CLASS = "UsbCameraPreviewView"
        private const val TAG = "UsbCameraPreview"
    }

    override fun getName(): String = REACT_CLASS

    override fun createViewInstance(reactContext: ThemedReactContext): TextureView {
        val textureView = TextureView(reactContext)
        textureView.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
                Log.i(TAG, "SurfaceTexture available: ${width}x${height}")
                val surface = Surface(surfaceTexture)
                UsbCameraDmsModule.activePreviewSurface = surface
                UsbCameraDmsModule.activeTextureView = textureView
            }

            override fun onSurfaceTextureSizeChanged(surfaceTexture: SurfaceTexture, width: Int, height: Int) {
                Log.i(TAG, "SurfaceTexture size changed: ${width}x${height}")
            }

            override fun onSurfaceTextureDestroyed(surfaceTexture: SurfaceTexture): Boolean {
                Log.i(TAG, "SurfaceTexture destroyed")
                UsbCameraDmsModule.activePreviewSurface?.release()
                UsbCameraDmsModule.activePreviewSurface = null
                UsbCameraDmsModule.activeTextureView = null
                return true
            }

            override fun onSurfaceTextureUpdated(surfaceTexture: SurfaceTexture) {
                // Invoked on each frame rendered to the surface
            }
        }
        return textureView
    }
}
