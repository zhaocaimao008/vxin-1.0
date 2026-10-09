package com.vxin.app.ui.components

import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.vxin.app.R

/** Shares the generated brand geometry with Web and iOS. */
@Composable
fun VxinLogoMark(modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(R.drawable.vxin_brand_mark),
        contentDescription = null,
        modifier = modifier,
        contentScale = ContentScale.Fit,
    )
}
