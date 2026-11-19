package com.focusnotes

import android.graphics.Color
import com.facebook.react.ReactActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : ReactActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        val decor = window.decorView
        val initialLeft = decor.paddingLeft
        val initialTop = decor.paddingTop
        val initialRight = decor.paddingRight
        val initialBottom = decor.paddingBottom
        ViewCompat.setOnApplyWindowInsetsListener(decor) { view, insets ->
            val safeInsets = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
            )
            view.setPadding(
                initialLeft + safeInsets.left,
                initialTop + safeInsets.top,
                initialRight + safeInsets.right,
                initialBottom + safeInsets.bottom,
            )
            insets
        }
        ViewCompat.requestApplyInsets(decor)
    }

    override fun getMainComponentName(): String = "FocusNotes"
}
