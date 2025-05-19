// src/app/services/database.service.ts
import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { SQLite, SQLiteObject } from '@awesome-cordova-plugins/sqlite/ngx';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Cliente, Pedido, Producto, PedidoItem, EstadoPedido } from '../models/pedido.model'; 

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private dbInstance: SQLiteObject | undefined;
  private readonly dbName: string = 'casalola.db';

  private dbReady = new BehaviorSubject<boolean>(false);
  // Podríamos tener BehaviorSubjects para productos también si es necesario cargarlos globalmente
  private productos = new BehaviorSubject<Producto[]>([]);

  constructor(private platform: Platform, private sqlite: SQLite) {
    this.platform.ready().then(() => {
      this.sqlite.create({
        name: this.dbName,
        location: 'default'
      })
      .then(async (db: SQLiteObject) => {
        this.dbInstance = db;
        console.log('Base de datos creada/abierta:', this.dbInstance);
        await this.createTables();
        // Opcional: Poblar la tabla Productos con ítems iniciales si no existen
        await this.seedProductos();
        this.dbReady.next(true);
        // Cargar productos una vez que la BD está lista
        this.loadProductos().subscribe();
      })
      .catch(e => {
        console.error('Error al inicializar la base de datos', e);
        this.dbReady.next(false);
      });
    }).catch(e => console.error('Platform not ready', e));
  }

  isDbReady(): Observable<boolean> {
    return this.dbReady.asObservable();
  }

  private async executeSql(sql: string, params?: any[]): Promise<any> {
    if (!this.dbInstance) {
      return Promise.reject(new Error('Instancia de BD no disponible.'));
    }
    return this.dbInstance.executeSql(sql, params);
  }

  private async createTables(): Promise<void> {
    // Habilitar foreign keys
    await this.executeSql('PRAGMA foreign_keys = ON;');

    try {
      await this.executeSql(`
        CREATE TABLE IF NOT EXISTS Clientes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre VARCHAR(150) NOT NULL,
          cedula CHAR(10) NOT NULL UNIQUE,
          telefono VARCHAR(50) NOT NULL
        )`, []);
      console.log('Tabla Clientes creada o ya existe.');

      // Nueva tabla Productos
      await this.executeSql(`
        CREATE TABLE IF NOT EXISTS Productos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre VARCHAR(50) NOT NULL UNIQUE
        )`, []);
      console.log('Tabla Productos creada o ya existe.');

      await this.executeSql(`
        CREATE TABLE IF NOT EXISTS Pedido (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cliente_id INTEGER NOT NULL,
          numero_tillo VARCHAR(50) NOT NULL UNIQUE,
          precio REAL NOT NULL,
          estado CHAR(2) NOT NULL,
          fecha_entrega TEXT NOT NULL,
          fecha_actualizacion TEXT NOT NULL,
          fecha_creacion TEXT NOT NULL,
          observacion VARCHAR(250),
          FOREIGN KEY (cliente_id) REFERENCES Clientes(id) ON DELETE CASCADE
        )`, []);
      console.log('Tabla Pedido creada o ya existe.');

      // Nueva tabla PedidoItems
      await this.executeSql(`
        CREATE TABLE IF NOT EXISTS PedidoItems (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pedido_id INTEGER NOT NULL,
          producto_id INTEGER NOT NULL,
          cantidad INTEGER NOT NULL,
          FOREIGN KEY (pedido_id) REFERENCES Pedido(id) ON DELETE CASCADE,
          FOREIGN KEY (producto_id) REFERENCES Productos(id) ON DELETE RESTRICT
        )`, []);
      console.log('Tabla PedidoItems creada o ya existe.');

    } catch (e) {
      console.error('Error creando tablas', e);
      throw e;
    }
  }

  // Método para poblar productos iniciales si es necesario (ejecutar una sola vez o verificar existencia)
  async seedProductos(): Promise<void> {
    const productosBase = [
      { nombre: 'Chancho' }, { nombre: 'Costilla' }, { nombre: 'Tortillas' },
      { nombre: 'Piernas' }, { nombre: 'Pavo' }, { nombre: 'Agrio' },
      { nombre: 'Brazos' }, { nombre: 'Pollos' }, { nombre: 'Motes' }
    ];

    for (const prod of productosBase) {
      try {
        // Intentar insertar, si falla por UNIQUE constraint (ya existe), no hacer nada.
        await this.executeSql('INSERT INTO Productos (nombre) VALUES (?)', [prod.nombre]);
        console.log(`Producto '${prod.nombre}' insertado.`);
      } catch (e: any) {
        if (e.message && e.message.includes('UNIQUE constraint failed')) {
          // console.log(`Producto '${prod.nombre}' ya existe.`);
        } else {
          console.error(`Error insertando producto '${prod.nombre}':`, e);
        }
      }
    }
  }

  // --- Métodos para Productos ---
  loadProductos(): Observable<Producto[]> {
    return this.isDbReady().pipe(
      switchMap(isReady => {
        if (!isReady || !this.dbInstance) {
          return of([]);
        }
        return from(this.executeSql('SELECT * FROM Productos ORDER BY nombre ASC', [])).pipe(
          map(res => {
            const items: Producto[] = [];
            if (res.rows.length > 0) {
              for (let i = 0; i < res.rows.length; i++) {
                items.push(res.rows.item(i) as Producto);
              }
            }
            this.productos.next(items); // Actualizar BehaviorSubject
            return items;
          }),
          catchError(e => {
            console.error('Error cargando productos', e);
            return of([]);
          })
        );
      })
    );
  }

  getProductosObservable(): Observable<Producto[]> {
    return this.productos.asObservable();
  }

  async getProductoPorNombre(nombre: string): Promise<Producto | null> {
    if (!this.dbReady.value || !this.dbInstance) return null;
    try {
      const res = await this.executeSql('SELECT * FROM Productos WHERE nombre = ?', [nombre]);
      if (res.rows.length > 0) {
        return res.rows.item(0) as Producto;
      }
      return null;
    } catch (e) {
      console.error('Error obteniendo producto por nombre', e);
      return null;
    }
  }


  // --- Métodos CRUD para Pedidos ---

  // Modificaremos addPedido para que también guarde los PedidoItems
  async addPedido(pedidoData: Omit<Pedido, 'id' | 'fecha_creacion' | 'fecha_actualizacion' | 'descripcion_trabajo_lista'>,
                  itemsData: Omit<PedidoItem, 'id' | 'pedido_id' | 'nombre_producto'>[]): Promise<number | null> {
    if (!this.dbReady.value || !this.dbInstance) return null;

    const fechaActual = new Date().toISOString();
    const numeroTilloCompleto = await this.generarNumeroTillo(pedidoData.numero_tillo); // Asumimos que numero_tillo en PedidoData es solo la parte manual

    try {
      const resultPedido = await this.executeSql(
        `INSERT INTO Pedido (cliente_id, numero_tillo, precio, estado, fecha_entrega, fecha_actualizacion, fecha_creacion, observacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pedidoData.cliente_id,
          numeroTilloCompleto,
          pedidoData.precio,
          pedidoData.estado,
          pedidoData.fecha_entrega,
          fechaActual,
          fechaActual,
          pedidoData.observacion
        ]
      );

      const pedidoId = resultPedido.insertId;
      if (pedidoId) {
        for (const item of itemsData) {
          if (item.cantidad > 0) { // Solo guardar si hay cantidad
            await this.executeSql(
              'INSERT INTO PedidoItems (pedido_id, producto_id, cantidad) VALUES (?, ?, ?)',
              [pedidoId, item.producto_id, item.cantidad]
            );
          }
        }
        return pedidoId;
      }
      return null;
    } catch (e) {
      console.error('Error añadiendo pedido y sus ítems', e);
      // Aquí podrías implementar un rollback si la inserción de ítems falla después de insertar el pedido.
      // SQLite soporta transacciones: BEGIN TRANSACTION, COMMIT, ROLLBACK.
      throw e;
    }
  }

  async getPedidosConDescripcion(): Promise<Pedido[]> {
    if (!this.dbReady.value || !this.dbInstance) return [];
    try {
      const query = `
        SELECT
          p.id, p.numero_tillo, p.precio, p.estado, p.fecha_entrega,
          p.fecha_creacion, p.observacion, p.cliente_id,
          c.nombre as nombre_cliente, c.cedula as cedula_cliente,
          (
            SELECT GROUP_CONCAT(pi.cantidad || ' ' || pr.nombre, ', ')
            FROM PedidoItems pi
            JOIN Productos pr ON pi.producto_id = pr.id
            WHERE pi.pedido_id = p.id
          ) as descripcion_trabajo_lista
        FROM Pedido p
        JOIN Clientes c ON p.cliente_id = c.id
        ORDER BY p.fecha_creacion DESC
      `;
      const result = await this.executeSql(query, []);
      const pedidos: Pedido[] = [];
      if (result.rows.length > 0) {
        for (let i = 0; i < result.rows.length; i++) {
          pedidos.push(result.rows.item(i) as Pedido);
        }
      }
      // this.pedidos.next(pedidos); // Si tienes un BehaviorSubject para pedidos
      return pedidos;
    } catch (e) {
      console.error('Error al obtener pedidos con descripción', e);
      return [];
    }
  }

  // Obtener un pedido con todos sus ítems
  async getPedidoConItems(pedidoId: number): Promise<Pedido | null> {
    if (!this.dbReady.value || !this.dbInstance) return null;
    try {
      const pedidoRes = await this.executeSql(`
        SELECT
          p.id, p.numero_tillo, p.precio, p.estado, p.fecha_entrega,
          p.fecha_actualizacion, p.fecha_creacion, p.observacion, p.cliente_id,
          c.nombre as nombre_cliente, c.cedula as cedula_cliente
        FROM Pedido p
        JOIN Clientes c ON p.cliente_id = c.id
        WHERE p.id = ?
      `, [pedidoId]);

      if (pedidoRes.rows.length === 0) {
        return null;
      }

      const pedidoData = pedidoRes.rows.item(0) as Pedido;

      const itemsRes = await this.executeSql(`
        SELECT pi.id, pi.pedido_id, pi.producto_id, pi.cantidad, pr.nombre as nombre_producto
        FROM PedidoItems pi
        JOIN Productos pr ON pi.producto_id = pr.id
        WHERE pi.pedido_id = ?
      `, [pedidoId]);

      const items: PedidoItem[] = [];
      if (itemsRes.rows.length > 0) {
        for (let i = 0; i < itemsRes.rows.length; i++) {
          items.push(itemsRes.rows.item(i) as PedidoItem);
        }
      }
      pedidoData.items = items;
      return pedidoData;

    } catch (e) {
      console.error(`Error al obtener pedido ${pedidoId} con ítems`, e);
      return null;
    }
  }

  // Faltarían métodos para actualizar pedido y sus items, eliminar pedido, etc.

  // --- Métodos para Clientes (ejemplos) ---
  async addCliente(cliente: Omit<Cliente, 'id'>): Promise<Cliente | null> {
    if (!this.dbReady.value || !this.dbInstance) return null;
    try {
      const result = await this.executeSql(
        'INSERT INTO Clientes (nombre, cedula, telefono) VALUES (?, ?, ?)',
        [cliente.nombre, cliente.cedula, cliente.telefono]
      );
      if (result.insertId) {
        return {id: result.insertId, ...cliente};
      }
      return null;
    } catch (e) {
      console.error('Error añadiendo cliente', e);
      throw e;
    }
  }

  async findClientePorCedula(cedula: string): Promise<Cliente | null> {
     if (!this.dbReady.value || !this.dbInstance) return null;
    try {
      const res = await this.executeSql('SELECT * FROM Clientes WHERE cedula = ?', [cedula]);
      if (res.rows.length > 0) {
        return res.rows.item(0) as Cliente;
      }
      return null;
    } catch (e) {
      console.error('Error buscando cliente por cédula', e);
      return null;
    }
  }

  // Método para generar el número de tillo con el año actual
  async generarNumeroTillo(tilloManual: string): Promise<string> {
    const anioActual = new Date().getFullYear();
    // Eliminar espacios y asegurarse de que tilloManual sea solo el número
    const tilloNumerico = tilloManual.replace(/[^0-9]/g, '');
    if (!tilloNumerico) {
        // Podrías lanzar un error o devolver un valor por defecto si es inválido
        console.warn("Número de tillo manual inválido o vacío después de limpiar:", tilloManual);
        // Devolver con un placeholder o manejar el error como prefieras
        return `${anioActual}_INVALIDO`;
    }
    return `${anioActual}_${tilloNumerico}`;
  }
}