import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="postgres",
    user="inventario_user",
    password="inventario_2024!"
)

cur = conn.cursor()
cur.execute("SELECT id, name, warehouse FROM inventario.inventory_lists WHERE name = 'clenio_00'")
result = cur.fetchone()
if result:
    print(f"ID: {result[0]}")
    print(f"Nome: {result[1]}")
    print(f"Armazém: {result[2]}")
else:
    print("Inventário não encontrado")
    
cur.close()
conn.close()
