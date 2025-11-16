📘 DOCUMENTACIÓN DE ENDPOINTS – MAURIZONE API
🔐 1. Registro de usuario

Crea un nuevo usuario.

POST

http://localhost:3000/api/auth/register


Headers

Content-Type: application/json


Body (JSON)

{
  "name": "Admin 1",
  "email": "admin1@email.com",
  "password": "123456"
}


📌 El rol NO se envía; se asigna automáticamente o se cambia luego en la base de datos.

🔑 2. Login

Autentica un usuario y devuelve un access_token.

POST

http://localhost:3000/api/auth/login


Headers

Content-Type: application/json


Body (JSON)

{
  "email": "owner1@email.com",
  "password": "123456"
}


Respuesta esperada

{
  "access_token": "JWT_TOKEN_AQUI"
}

🏬 3. Crear tienda

Solo para usuarios con STORE_OWNER o ADMIN.

POST

http://localhost:3000/api/stores


Headers

Content-Type: application/json
Authorization: Bearer JWT_TOKEN_AQUI


Body (JSON)

{
  "name": "Tienda Owner 1",
  "ownerId": 2
}


Respuesta

{
  "id": 1,
  "name": "Tienda Owner 1",
  "ownerId": 2,
  "createdAt": "...",
  "updatedAt": "..."
}

🛒 4. Crear producto con imágenes

Requiere que el OWNER tenga una tienda creada.

POST

http://localhost:3000/api/products


Headers

Authorization: Bearer JWT_TOKEN_AQUI


⚠️ NO poner Content-Type, Postman lo genera automáticamente.

Body (form-data)
KEY	VALUE	TYPE
name	Producto demo	Text
description	Descripcion Producto demo	Text
price	9.99	Text
storeId	1	Text
images	prod1a.jpg	File
images	prod1b.jpg	File

📌 Puedes repetir images tantas veces como quieras.

📦 Ejemplo completo en Postman (visual)

📑 Resumen rápido
Acción	Método	URL	Auth
Registrar usuario	POST	/api/auth/register	❌
Login	POST	/api/auth/login	❌
Crear tienda	POST	/api/stores	✔️ Bearer
Crear producto	POST	/api/products	✔️ Bearer
Subir imágenes	multipart/form-data en /api/products	✔️ Bearer	