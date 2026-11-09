# InsureDesk (PHP + MySQL)

เวอร์ชัน PHP ของระบบค้นหาและเปรียบเทียบประกันรถยนต์ ทำงานแยกจากแอป Next.js ในโฟลเดอร์ราก ไม่ใช้โค้ดหรือฐานข้อมูลร่วมกันโดยค่าเริ่มต้น

## ต้องมี

- PHP 8.1 ขึ้นไป พร้อม extension `pdo_mysql`, `mbstring`, `sodium`
- MySQL 8.0.16 ขึ้นไป

ไม่ต้องใช้ Composer หรือ Node.js ตอนรันแอป

## เริ่มใช้งาน

คำสั่งทั้งหมดรันจากโฟลเดอร์ `php/`

```bash
cp .env.example .env
```

แก้ `DATABASE_URL` ใน `.env` ให้ตรงกับ MySQL ของคุณ ค่าเริ่มต้นคือฐานข้อมูลใหม่ชื่อ `insuredesk_php` จึงไม่กระทบข้อมูลของระบบเดิม แล้วสร้างตารางและใส่ข้อมูลตัวอย่าง:

```bash
php bin/db.php migrate
```

```bash
php bin/db.php seed
```

```bash
php -d upload_max_filesize=16M -d post_max_size=17M -S localhost:8080 -t public public/index.php
```

เปิด <http://localhost:8080> แล้วเลือกบัญชีจำลองในหน้าเข้าสู่ระบบ (เมื่อตั้ง `ENABLE_DEMO_AUTH=true`)

## รันบน Apache / MAMP

ชี้ DocumentRoot ไปที่ `php/public` หรือเปิดผ่าน subfolder ได้ เช่น `http://localhost/insuredesk/php/public/` โดยต้องเปิด `AllowOverride All` และ `mod_rewrite` ไฟล์ `.htaccess` กันไม่ให้เว็บเข้าถึง `.env`, `src/` และ `storage/`

บน nginx ให้ root ไปที่ `php/public` และใช้ `try_files $uri /index.php?$query_string` ต้องตั้ง `client_max_body_size 17m` ด้วย

## คำสั่งฐานข้อมูล

| คำสั่ง | หน้าที่ |
|---|---|
| `php bin/db.php migrate` | สร้างฐานข้อมูลถ้ายังไม่มี และรัน `db/migrations/*.sql` ที่ยังไม่เคยรัน |
| `php bin/db.php seed` | ใส่ข้อมูลตัวอย่างจาก `db/seed.sql` (ไม่ทำงานถ้ามีแพ็กเกจอยู่แล้ว) |
| `php bin/db.php reset` | ลบฐานข้อมูลใน `DATABASE_URL` แล้วสร้างใหม่พร้อมข้อมูลตัวอย่าง |
| `php bin/db.php create-user` | สร้างบัญชีผู้ใช้จริง |

สร้างบัญชีผู้ดูแลระบบคนแรก (รหัสผ่านอย่างน้อย 12 ตัวอักษร):

```bash
INSUREDESK_USER_PASSWORD='change-me-please' php bin/db.php create-user --email admin@example.com --name "ชื่อผู้ดูแล" --role admin
```

## ย้ายข้อมูลจากระบบเดิม

Schema, รูปแบบ session และ hash รหัสผ่านเหมือนระบบเดิมทุกประการ บัญชีและรหัสผ่านเดิมจึงใช้ได้ทันที ถ้าต้องการนำข้อมูลจริงมาใช้ ให้คัดลอกฐานข้อมูล แล้วชี้ `DATABASE_URL` ไปที่ฐานข้อมูลใหม่:

```bash
mysqldump -u root -p insuredesk | mysql -u root -p insuredesk_php
```

แล้วคัดลอกไฟล์เอกสารจาก `storage/documents` ของระบบเดิมมาไว้ที่ `php/storage/documents`

## การทดสอบ

ตั้ง `TEST_DATABASE_URL` เป็นฐานข้อมูลที่ชื่อลงท้ายด้วย `_test` ซึ่งจะถูกลบและสร้างใหม่ทุกครั้ง

```bash
php tests/run.php
```

## แก้หน้าตา

CSS ถูก build ไว้แล้วที่ `public/assets/app.css` ถ้าเพิ่ม Tailwind class ใหม่ใน `views/` หรือ `public/assets/` ให้ build ใหม่จากโฟลเดอร์รากของ repo:

```bash
node php/tools/build-css.mjs
```

## Production

- ตั้ง `APP_ENV=production` และห้ามตั้ง `ENABLE_DEMO_AUTH=true` ไม่ต้องรัน `seed`
- ถ้ารันผ่าน HTTP ธรรมดา ต้องตั้ง `SESSION_COOKIE_INSECURE=true` ไม่เช่นนั้นเบราว์เซอร์จะไม่เก็บ cookie
- `storage/documents` ต้องเขียนได้โดย web server ใช้ดิสก์ถาวร และสำรองคู่กับฐานข้อมูล
- ห้ามเปิดพอร์ต MySQL สู่ภายนอก เพราะการตรวจสิทธิ์อยู่ที่ชั้นแอป
