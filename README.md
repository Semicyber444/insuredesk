# InsureDesk

ระบบค้นหาและเปรียบเทียบประกันรถยนต์ภายในทีม สร้างด้วย Next.js และ MySQL

## เริ่มใช้งาน

ต้องมี Node.js 22 ขึ้นไป และ MySQL 8.0.16 ขึ้นไป

```bash
npm install
```

```bash
cp .env.example .env.local
```

แก้ `DATABASE_URL` ใน `.env.local` ให้ตรงกับ MySQL ของคุณ แล้วสร้างตารางและใส่ข้อมูลตัวอย่าง:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

เปิด <http://localhost:3000> แล้วเลือกบัญชีจำลองในหน้าเข้าสู่ระบบ (เมื่อตั้ง `ENABLE_DEMO_AUTH=true`)

## คำสั่งฐานข้อมูล

| คำสั่ง | หน้าที่ |
|---|---|
| `npm run db:migrate` | สร้างฐานข้อมูลถ้ายังไม่มี และรัน `db/migrations/*.sql` ที่ยังไม่เคยรัน |
| `npm run db:seed` | ใส่ข้อมูลตัวอย่างจาก `db/seed.sql` (ไม่ทำงานถ้ามีแพ็กเกจอยู่แล้ว) |
| `npm run db:reset` | ลบฐานข้อมูลใน `DATABASE_URL` แล้วสร้างใหม่พร้อมข้อมูลตัวอย่าง |
| `npm run db:create-user` | สร้างบัญชีผู้ใช้จริง |

สร้างบัญชีผู้ดูแลระบบคนแรก (รหัสผ่านอย่างน้อย 12 ตัวอักษร):

```bash
INSUREDESK_USER_PASSWORD='change-me-please' npm run db:create-user -- --email admin@example.com --name "ชื่อผู้ดูแล" --role admin
```

## การทดสอบ

Test รันกับ MySQL จริง ตั้ง `TEST_DATABASE_URL` เป็นฐานข้อมูลที่ชื่อลงท้ายด้วย `_test` ซึ่งจะถูกลบและสร้างใหม่ทุกครั้ง

```bash
npm test
```

## Production

- ตั้ง `DATABASE_URL` ตอนรันแอป และรัน `node scripts/db.mjs migrate` ก่อนเริ่มแอป
- ไม่ต้องรัน `db:seed` และห้ามตั้ง `ENABLE_DEMO_AUTH=true`
- เอกสารที่อัปโหลดเก็บใน `storage/documents` ต้องใช้ดิสก์ถาวรและสำรองคู่กับฐานข้อมูล
- ห้ามเปิดพอร์ต MySQL สู่ภายนอก เพราะการตรวจสิทธิ์อยู่ที่ชั้นแอป
