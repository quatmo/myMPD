/* myMPD
   (c) 2018-2019 Juergen Mang <mail@jcgames.de>
   This project's homepage is: https://github.com/jcorporation/mympd
   
   myMPD ist fork of:
   
   ympd
   (c) 2013-2014 Andrew Karpow <andy@ndyk.de>
   This project's homepage is: http://www.ympd.org
   
   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; version 2 of the License.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License along
   with this program; if not, write to the Free Software Foundation, Inc.,
   Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

#define INCBIN_PREFIX 
#define INCBIN_STYLE INCBIN_STYLE_SNAKE
#include "../dist/src/incbin/incbin.h"

//compressed assets
INCBIN(sw_js, "../dist/htdocs/sw.js.gz");
INCBIN(mympd_webmanifest, "../dist/htdocs/mympd.webmanifest.gz");
INCBIN(index_html, "../dist/htdocs/index.html.gz");
INCBIN(coverimage_notavailable_svg, "../dist/htdocs/assets/coverimage-notavailable.svg.gz");
INCBIN(coverimage_stream_svg, "../dist/htdocs/assets/coverimage-stream.svg.gz");
INCBIN(coverimage_loading_svg, "../dist/htdocs/assets/coverimage-loading.svg.gz");
INCBIN(combined_css, "../dist/htdocs/css/combined.css.gz");
INCBIN(combined_js, "../dist/htdocs/js/combined.js.gz");
//uncompressed assets
INCBIN(favicon_ico, "../htdocs/assets/favicon.ico");
INCBIN(appicon_192_png, "../htdocs/assets/appicon-192.png");
INCBIN(appicon_512_png, "../htdocs/assets/appicon-512.png");
INCBIN(MaterialIcons_Regular_woff2, "../htdocs/assets/MaterialIcons-Regular.woff2");

struct embedded_file {
  const char *uri;
  const char *mimetype;
  bool compressed;
  const unsigned char *data;
  const unsigned size;
};

static bool serve_embedded_files(struct mg_connection *nc, struct http_message *hm) {
    const struct embedded_file embedded_files[] = {
        {"/", "text/html", true, index_html_data, index_html_size},
        {"/css/combined.css", "text/css", true, combined_css_data, combined_css_size},
        {"/js/combined.js", "application/javascript", true, combined_js_data, combined_js_size},
        {"/sw.js", "application/javascript", true, sw_js_data, sw_js_size},
        {"/mympd.webmanifest", "application/manifest+json", true, mympd_webmanifest_data, mympd_webmanifest_size},
        {"/assets/coverimage-notavailable.svg", "image/svg+xml", true, coverimage_notavailable_svg_data, coverimage_notavailable_svg_size},
        {"/assets/MaterialIcons-Regular.woff2", "font/woff2", false, MaterialIcons_Regular_woff2_data, MaterialIcons_Regular_woff2_size},
        {"/assets/coverimage-stream.svg", "image/svg+xml", true, coverimage_stream_svg_data, coverimage_stream_svg_size},
        {"/assets/coverimage-loading.svg", "image/svg+xml", true, coverimage_loading_svg_data, coverimage_loading_svg_size},
        {"/assets/favicon.ico", "image/vnd.microsoft.icon", false, favicon_ico_data, favicon_ico_size},
        {"/assets/appicon-192.png", "image/png", false, appicon_192_png_data, appicon_192_png_size},
        {"/assets/appicon-512.png", "image/png", false, appicon_512_png_data, appicon_512_png_size},
        {NULL, NULL, false, NULL, 0}
    };
    //decode uri
    int uri_decoded_len;
    char uri_decoded[(size_t)hm->uri.len + 1];
    
    if ((uri_decoded_len = mg_url_decode(hm->uri.p, (int)hm->uri.len, uri_decoded, (int)hm->uri.len + 1, 0)) == -1) {
        LOG_ERROR("uri_decoded buffer to small");
        mg_printf(nc, "%s", "HTTP/1.1 500 INTERNAL SERVER ERROR\r\n\r\n");
        return false;
    }
    //set index.html as direcory index
    if (strcmp(uri_decoded, "/index.html") == 0) {
        uri_decoded_len = 1;
    }
    //find fileinfo
    const struct embedded_file *p = NULL;
    for (p = embedded_files; p->uri != NULL; p++) {
        if (uri_decoded_len == (int)strlen(p->uri) && strncmp(p->uri, uri_decoded, uri_decoded_len) == 0) {
            break;
        }
    }
    
    if (p->compressed == true) {
        struct mg_str *header_encoding = mg_get_http_header(hm, "Accept-Encoding");
        if (header_encoding == NULL || mg_strstr(mg_mk_str_n(header_encoding->p, header_encoding->len), mg_mk_str("gzip")) == NULL) {
            mg_printf(nc, "%s", "HTTP/1.1 406 BROWSER DONT SUPPORT GZIP COMPRESSION\r\n\r\n");
            return false;
        }
    }

    if (p != NULL) {
        //send header
        mg_printf(nc, "HTTP/1.1 200 OK\r\n"
                      EXTRA_HEADERS"\r\n"
                      "Content-Length: %u\r\n"
                      "Content-Type: %s\r\n"
                      "%s\r\n",
                      p->size,
                      p->mimetype,
                      (p->compressed == true ? "Content-Encoding: gzip\r\n" : "")
                 );
        //send data
        mg_send(nc, p->data, p->size);
        mg_send(nc, "\r\n", 2);
        return true;
    }
    else {
        LOG_ERROR("Embedded asset %.*s not found", (int)hm->uri.len, hm->uri.p);
        mg_printf(nc, "%s", "HTTP/1.1 404 NOT FOUND\r\n\r\n");
    }
    return false;
}
