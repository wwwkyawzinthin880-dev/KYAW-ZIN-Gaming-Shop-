package com.kyawzin.admin;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
public class MainActivity extends Activity {
 @Override public void onCreate(Bundle b){super.onCreate(b); WebView w=new WebView(this); w.setWebViewClient(new WebViewClient()); WebSettings s=w.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); w.loadUrl("https://wwwkyawzinthin880-dev.github.io/KYAW-ZIN-Gaming-Shop-/admin.html"); setContentView(w);}
 @Override public void onBackPressed(){ WebView w=(WebView)findViewById(android.R.id.content); super.onBackPressed(); }
}
