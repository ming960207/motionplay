package com.motionplay.tv

import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.widget.Toast
import android.widget.EditText
import android.app.AlertDialog
import android.view.KeyEvent

class MainActivity : Activity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    Toast.makeText(this@MainActivity, "页面加载失败：" + error.description, Toast.LENGTH_LONG).show()
                }
            }
        }
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
        setContentView(webView)
        val address = getPreferences(MODE_PRIVATE).getString("tv_url", null)
        if (address == null) configureServer() else webView.loadUrl(address)
    }

    private fun configureServer() {
        val field = EditText(this)
        field.setSingleLine()
        field.setText(getPreferences(MODE_PRIVATE).getString("tv_url", "http://192.168.1.100:3000/tv-motion/index.html"))
        AlertDialog.Builder(this)
            .setTitle("输入 MotionPlay 服务地址")
            .setView(field)
            .setCancelable(false)
            .setPositiveButton("连接") { _, _ ->
                val value = field.text.toString().trim()
                if (!value.startsWith("http://") && !value.startsWith("https://")) {
                    configureServer()
                } else {
                    getPreferences(MODE_PRIVATE).edit().putString("tv_url", value).apply()
                    webView.loadUrl(value)
                }
            }
            .show()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView.canGoBack()) {
                webView.goBack()
            } else {
                configureServer()
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
