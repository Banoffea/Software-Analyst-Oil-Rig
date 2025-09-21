# Software-Analyst-Oil-Rig
### วิธีการติดตั้งโปรแกรม 

> ลง Node.js

1) เปิด 2 terminal เข้าไปที่ frontend, backend
2) พิมพ์คำสั่ง ```npm i``` ทั้ง 2 terminal เพื่อติดตั้ง package ใน project 
3) พิมพ์คำสั่ง ```npm run dev``` ทั้ง 2 terminal
    * ทาง frontend จะขึ้นลิ้ง localhost:5173 ให้กดได้ อันนั้นคือหน้า dashboard หลักของเรา
         ```
        VITE v5.4.20  ready in 1183 ms

        ➜  Local:   http://localhost:5173/
        ➜  Network: use --host to expose
        ➜  press h + enter to show help
        ```
    * ทาง backend ขึ้นว่า 

        ```
        [nodemon] 2.0.22
        [nodemon] to restart at any time, enter `rs`
        [nodemon] watching path(s): *.*
        [nodemon] watching extensions: js,mjs,json
        [nodemon] starting `node src/server.js`
        API on : 8000
        ```
4) เปิด XAMPP start apache, mySQL เข้าไปดูข้อมูลใน http://localhost/phpmyadmin/ ได้

5) เข้า http://localhost:5173/ หาก ```Error``` หรือ ```ล็อกอินไม่เข้า``` ให้ไปแก้ ไฟล์ .env

        PORT=8000
        DB_HOST=127.0.0.1
        DB_USER=root
        DB_PASSWORD=
        DB_NAME=oilrig_DB ------> แก้ให้ตรงตาม database ของตัวเอง
        DB_PORT=3306
        JWT_SECRET=supersecretkey
        SIM_IPS=*

6) เข้า link 

    * http://localhost:8000/sim ---> ลิ้งค์ simulate การเดินเรือ
    * http://localhost:8000/oil-sim ---> ลิงค์ simulate แท่นขุดเจาะ

7) หากต้องการเล่น simulate ในเครื่องอื่นและดู ผลในอีกเครื่อง 
    * ต่อ WIFI  เดียวกันทั้ง 2 เครื่อง
    * พิมพ์ค้นหา terminal หรือ cmd ใน window คลิ๊กขวา Run as administator
    * พิมพ์คำสั่งด้านล่างใน terminal และ run
        ```
        New-NetFirewallRule -DisplayName "Node-8000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -Profile Private,Domain
        ```
    * ลองเข้า link simulator ทั้ง 2 link ได้เลย

***
หมายเหตุ : 
 * หากเกิด Error อะไรแปลกๆ ให้เอา Error ที่ขึ้นใน ```terminal``` หรือดู Error ที่หน้าเว็ปไซต์นั้นๆ และกด ```F12``` ดู console หรือดูตรง network แล้ว ให็ chatGPT ดูได้เลย

* โค้ดสามารถปรับแก้เล่นได้หมดเลยหากเห็นว่าดีแล้วก็ push ขึ้น Develop เลย