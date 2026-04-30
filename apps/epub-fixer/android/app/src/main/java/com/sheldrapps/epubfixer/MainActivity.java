package com.sheldrapps.epubfixer;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.sheldrapps.plugins.epubrewrite.EpubRewritePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(EpubRewritePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
