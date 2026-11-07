package com.motionplay.tv

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.ContentUris
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import android.view.KeyEvent
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.Toast

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
                completeFileChooser(null)
                this@MainActivity.fileChooserCallback = filePathCallback
                return try {
                    startActivityForResult(fileChooserParams.createIntent(), FILE_CHOOSER_REQUEST)
                    true
                } catch (error: ActivityNotFoundException) {
                    showLocalAudioPicker()
                    true
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
            completeFileChooser(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != AUDIO_PERMISSION_REQUEST) return
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            showLocalAudioPicker()
        } else {
            completeFileChooser(null)
            Toast.makeText(this, "需要允许访问音频才能选择本地歌曲", Toast.LENGTH_LONG).show()
        }
    }

    private fun showLocalAudioPicker() {
        val permission = if (Build.VERSION.SDK_INT >= 33 && applicationInfo.targetSdkVersion >= 33) {
            Manifest.permission.READ_MEDIA_AUDIO
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }
        if (checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(permission), AUDIO_PERMISSION_REQUEST)
            return
        }

        try {
            val songs = mutableListOf<Pair<Uri, String>>()
            val projection = arrayOf(
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.DISPLAY_NAME,
                MediaStore.Audio.Media.ARTIST
            )
            contentResolver.query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC"
            )?.use { cursor ->
                val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                val nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
                val artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                while (cursor.moveToNext()) {
                    val title = cursor.getString(titleColumn)?.takeIf { it.isNotBlank() }
                        ?: cursor.getString(nameColumn)
                        ?: "未命名音频"
                    val artist = cursor.getString(artistColumn)?.takeIf { it.isNotBlank() && it != "<unknown>" }
                    val label = if (artist == null) title else "$title · $artist"
                    val uri = ContentUris.withAppendedId(
                        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                        cursor.getLong(idColumn)
                    )
                    songs += uri to label
                }
            }

            if (songs.isEmpty()) {
                completeFileChooser(null)
                Toast.makeText(this, "电视媒体库中没有可选歌曲", Toast.LENGTH_LONG).show()
                return
            }

            AlertDialog.Builder(this)
                .setTitle("选择本地歌曲")
                .setItems(songs.map { it.second }.toTypedArray()) { _, index ->
                    completeFileChooser(arrayOf(songs[index].first))
                }
                .setOnCancelListener { completeFileChooser(null) }
                .show()
        } catch (error: SecurityException) {
            completeFileChooser(null)
            Toast.makeText(this, "无法读取电视媒体库，请检查音频权限", Toast.LENGTH_LONG).show()
        }
    }

    private fun completeFileChooser(uris: Array<Uri>?) {
        val callback = fileChooserCallback ?: return
        fileChooserCallback = null
        if ((applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            Log.d("MotionPlayTV", "File chooser completed with ${uris?.size ?: 0} URI(s)")
        }
        callback.onReceiveValue(uris)
    }

    override fun onDestroy() {
        completeFileChooser(null)
        webView.destroy()
        super.onDestroy()
    }

    private companion object {
        const val FILE_CHOOSER_REQUEST = 1001
        const val AUDIO_PERMISSION_REQUEST = 1002
    }
}
