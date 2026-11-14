import {readFile} from "node:fs/promises";
import {parse} from "dotenv";
import {Client} from "pg";

const env=parse(await readFile(".env.local","utf8"));
const db=new Client({connectionString:env.DATABASE_URL,connectionTimeoutMillis:5000});
try {
  await db.connect();
  const username=process.argv[2];
  if(!username)throw new Error("Specify the confirmed owner username");
  await db.query("BEGIN");
  const result=await db.query("INSERT INTO user_roles (user_id,role) SELECT id,'admin' FROM users WHERE username=$1 AND email_verified AND blocked_at IS NULL ON CONFLICT(user_id) DO UPDATE SET role='admin' RETURNING user_id",[username]);
  if(result.rowCount!==1)throw new Error("Verified owner not found");
  await db.query("UPDATE users SET personal_badge=true WHERE id=$1",[result.rows[0].user_id]);
  const verified=await db.query("SELECT u.username,r.role,u.personal_badge FROM users u JOIN user_roles r ON r.user_id=u.id WHERE u.id=$1",[result.rows[0].user_id]);
  await db.query("COMMIT");
  console.log(JSON.stringify(verified.rows[0]));
}catch{await db.query("ROLLBACK").catch(()=>{});console.error("Не удалось назначить администратора. Проверь явно указанный username и наличие подтверждённого аккаунта. Секреты не выводятся.");process.exitCode=1;}
finally{await db.end();}
