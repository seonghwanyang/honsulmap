package com.honsulmap.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // 하드웨어 뒤로가기: 웹뷰 히스토리가 있으면 이전 화면으로,
    // 더 갈 곳 없으면(루트) 기본 동작(앱 종료/최소화). PR-6.
    @Override
    public void onBackPressed() {
        if (this.getBridge().getWebView().canGoBack()) {
            this.getBridge().getWebView().goBack();
        } else {
            super.onBackPressed();
        }
    }
}
