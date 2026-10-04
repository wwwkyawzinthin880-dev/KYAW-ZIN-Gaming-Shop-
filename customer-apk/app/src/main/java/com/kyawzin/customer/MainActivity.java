package com.kyawzin.customer;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
public class MainActivity extends Activity {
 private WebView webView;
 @Override public void onCreate(Bundle b){
  super.onCreate(b);
  webView=new WebView(this);
  WebSettings s=webView.getSettings();
  s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
  s.setLoadWithOverviewMode(true); s.setUseWideViewPort(true);
  webView.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return false;}});
  webView.loadUrl("https://wwwkyawzinthin880-dev.github.io/KYAW-ZIN-Gaming-Shop-/?v=20261004-1");
  setContentView(webView);
 }
 @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else super.onBackPressed();}
}
