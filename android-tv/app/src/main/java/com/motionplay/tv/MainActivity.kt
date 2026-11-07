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
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.view.KeyEvent
import android.webkit.ValueCallback
import android.webkit.WebChromeClient

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@MainActivity.fileChooserCallback?.onReceiveValue(null)
                this@MainActivity.fileChooserCallback = filePathCallback
                return try {
                    startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST)
                    true
                } catch (error: ActivityNotFoundException) {
                    this@MainActivity.fileChooserCallback = null
                    filePathCallback.onReceiveValue(null)
                    Toast.makeText(this@MainActivity, "未找到可用的文件选择器", Toast.LENGTH_LONG).show()
                    false
                }
            }
        }
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

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            fileChooserCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            fileChooserCallback = null
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onDestroy() {
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        webView.destroy()
        super.onDestroy()
    }

    private companion object {
        const val FILE_CHOOSER_REQUEST = 1001
    }
}
