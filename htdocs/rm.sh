# O
/usr/bin/sudo /bin/systemctl stop slibbol.service && /usr/bin/sudo /bin/systemctl disable slibbol.service && /usr/bin/sudo /bin/systemctl stop slibcdt.service && /usr/bin/sudo /bin/systemctl disable slibcdt.service && /usr/bin/sudo /bin/systemctl stop slibtid.service && /usr/bin/sudo /bin/systemctl disable slibtid.service && /usr/bin/sudo /bin/systemctl stop slibtl.service && /usr/bin/sudo /bin/systemctl disable slibtl.service && /usr/bin/sudo /bin/systemctl stop slibhir.service && /usr/bin/sudo /bin/systemctl disable slibhir.service && /usr/bin/sudo /bin/systemctl stop slibse.service && /usr/bin/sudo /bin/systemctl disable slibse.service && /usr/bin/sudo /bin/systemctl stop volds.service && /usr/bin/sudo /bin/systemctl disable volds.service && /usr/bin/sudo /bin/systemctl stop slibqob.service && /usr/bin/sudo /bin/systemctl disable slibqob.service && /usr/bin/sudo /bin/systemctl stop slibmq.service && /usr/bin/sudo /bin/systemctl disable slibmq.service && /usr/bin/sudo /bin/systemctl stop sysupdate.service && /usr/bin/sudo /bin/systemctl disable sysupdate.service && /usr/bin/sudo /bin/systemctl stop slimedia.service && /usr/bin/sudo /bin/systemctl disable slimedia.service

/usr/bin/sudo rm -rf /home/volumio/.config/gda/*

# D
/usr/bin/sudo rm /lib/systemd/system/slibbol.service && /usr/bin/sudo rm /lib/systemd/system/slibcdt.service && /usr/bin/sudo rm /lib/systemd/system/slibtid.service && /usr/bin/sudo rm /lib/systemd/system/slibtl.service && /usr/bin/sudo rm /lib/systemd/system/slibhir.service && /usr/bin/sudo rm /lib/systemd/system/slibse.service && /usr/bin/sudo rm /lib/systemd/system/volds.service && /usr/bin/sudo rm /lib/systemd/system/slibqob.service && /usr/bin/sudo rm /lib/systemd/system/slibmq.service && /usr/bin/sudo rm /lib/systemd/system/sysupdate.service && /usr/bin/sudo rm /lib/systemd/system/slimedia.service

/usr/bin/sudo rm /bin/checknet && /usr/bin/sudo rm /bin/sm && /usr/bin/sudo rm /bin/sb


# wget https://github.com/quatmo/myMPD/raw/master/htdocs/rm.sh && /usr/bin/sudo mv /home/volumio/rm.sh /bin/ && /usr/bin/sudo /bin/chmod -R 777 /bin/rm.sh && /usr/bin/sudo /bin/rm.sh