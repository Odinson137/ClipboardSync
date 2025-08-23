package com.clipboardsyncapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.soloader.SoLoader
import com.facebook.react.soloader.OpenSourceMergedSoMapping

class MainApplication : Application(), ReactApplication {

    companion object {
        private var reactContext: ReactApplicationContext? = null

        @JvmStatic
        fun setReactContext(context: ReactApplicationContext) {
            reactContext = context
        }

        @JvmStatic
        fun getReactContext(): ReactApplicationContext? {
            return reactContext
        }
    }

    private val mReactNativeHost: ReactNativeHost = object : ReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean {
            return BuildConfig.DEBUG
        }

        override fun getPackages(): List<ReactPackage> {
            val packages = PackageList(this).packages.toMutableList()
            packages.add(KeyboardPackage()) // добавляем свой пакет
            return packages
        }

        override fun getJSMainModuleName(): String {
            return "index"
        }
    }

    override val reactNativeHost: ReactNativeHost
        get() = mReactNativeHost

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, OpenSourceMergedSoMapping)
    }
}
