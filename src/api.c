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

#include <string.h>
#include <stdlib.h>
#include <pthread.h>

#include "api.h"

enum mympd_cmd_ids get_cmd_id(const char *cmd) {
    const char * mympd_cmd_strs[] = { MYMPD_CMDS(GEN_STR) };

    for (unsigned i = 0; i < sizeof(mympd_cmd_strs) / sizeof(mympd_cmd_strs[0]); i++)
        if (!strncmp(cmd, mympd_cmd_strs[i], strlen(mympd_cmd_strs[i])))
            return i;

    return 0;
}
