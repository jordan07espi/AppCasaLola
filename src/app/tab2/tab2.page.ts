// src/app/tab2/tab2.page.ts
import { Component, OnInit, OnDestroy } from '@angular/core'; // Eliminé ViewChild si no se usa
import { Router } from '@angular/router';
import { ActionSheetController, AlertController, LoadingController, NavController, Platform, ToastController, IonItemSliding } from '@ionic/angular'; // IonItemSliding podría necesitarse aquí si se accede programáticamente
import { Subscription } from 'rxjs';
import { DatabaseService } from '../services/database.service'; // Ajusta la ruta si es necesario
import { Pedido } from '../models/pedido.model'; // Ajusta la ruta si es necesario
import { DatePipe } from '@angular/common'; // DatePipe se inyecta, CurrencyPipe se usa en template

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false, // Asegúrate que esté en false o eliminada esta línea

})
export class Tab2Page implements OnInit, OnDestroy {

  todosLosPedidos: Pedido[] = [];
  pedidosMostrados: Pedido[] = [];
  isLoading = true;
  private dbReadySubscription: Subscription | undefined;
  private searchTerm: string = '';
  isDatabaseReady: boolean = false;

  constructor(
    private databaseService: DatabaseService,
    private router: Router,
    private navController: NavController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private platform: Platform,
    private datePipe: DatePipe, // DatePipe se inyecta
  ) {}

  ngOnInit() {
    this.dbReadySubscription = this.databaseService.isDbReady().subscribe(isReady => {
      this.isDatabaseReady = isReady;
      if (isReady) {
        console.log('Database is ready, loading pedidos in ngOnInit.');
        this.cargarPedidos();
      } else {
        console.log('Base de datos aún no lista en Tab2Page ngOnInit');
      }
    });
  }

  ionViewWillEnter() {
    if (this.isDatabaseReady) {
       console.log('Database is ready, loading pedidos in ionViewWillEnter.');
       this.cargarPedidos();
    } else {
        console.log('Database not ready yet in ionViewWillEnter, waiting for ngOnInit subscription.');
    }
  }

  async cargarPedidos(event?: any) {
    if (!this.isDatabaseReady) {
      console.warn('DB no lista, no se pueden cargar pedidos.');
      if (event) event.target.complete();
      this.isLoading = false;
      if (this.todosLosPedidos.length === 0 && this.pedidosMostrados.length === 0) {
        this.mostrarToast('La base de datos no está disponible. Intente más tarde.', 3000);
      }
      return;
    }

    if (!event) {
        this.isLoading = true;
    }

    try {
      this.todosLosPedidos = await this.databaseService.getPedidosConDescripcion();
      this.filtrarPedidos();
      console.log('Pedidos cargados:', this.todosLosPedidos);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      this.mostrarToast('Error al cargar los pedidos.');
    } finally {
      this.isLoading = false;
      if (event) {
        event.target.complete();
      }
    }
  }

  handleSearch(event: any) {
    this.searchTerm = event.target.value.toLowerCase();
    this.filtrarPedidos();
  }

  clearSearch() {
    this.searchTerm = '';
    this.filtrarPedidos();
  }

  filtrarPedidos() {
    if (!this.searchTerm) {
      this.pedidosMostrados = [...this.todosLosPedidos];
    } else {
      this.pedidosMostrados = this.todosLosPedidos.filter(pedido =>
        (pedido.numero_tillo && pedido.numero_tillo.toLowerCase().includes(this.searchTerm)) ||
        (pedido.cedula_cliente && pedido.cedula_cliente.toLowerCase().includes(this.searchTerm)) ||
        (pedido.nombre_cliente && pedido.nombre_cliente.toLowerCase().includes(this.searchTerm))
      );
    }
  }

  handleRefresh(event: any) {
    this.cargarPedidos(event);
  }

  formatearFecha(fechaISO: string): string {
    if (!fechaISO) return 'N/A';
    try {
        const fecha = new Date(fechaISO);
        const fechaFormateada = fecha.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const horaFormateada = fecha.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${fechaFormateada} ${horaFormateada}`;
    } catch (e) {
        console.error("Error formateando fecha:", fechaISO, e);
        return this.datePipe.transform(fechaISO, 'dd/MM/yy HH:mm') || 'Fecha inválida';
    }
  }

  navegarARegistroPedido() {
    this.navController.navigateForward('/tabs/registro-pedido');
    console.log('Navegar a registrar pedido');
  }

  verDetallePedido(pedidoId?: number) {
    if (pedidoId === undefined) return;
    this.navController.navigateForward(`/tabs/detalle-pedido/${pedidoId}`);
    console.log('Ver detalle del pedido:', pedidoId);
  }

  editarPedido(pedidoId: number | undefined, slidingItem: IonItemSliding) {
    if (pedidoId === undefined) return;
    slidingItem.close();
    this.navController.navigateForward(`/tabs/editar-pedido/${pedidoId}`);
    console.log('Editar pedido:', pedidoId);
  }

  async confirmarEliminarPedido(pedidoId: number | undefined, slidingItem: IonItemSliding) {
    if (pedidoId === undefined) return;
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de que deseas eliminar el pedido #${pedidoId}? Esta acción no se puede deshacer.`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          handler: () => {
            slidingItem.close();
          }
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            slidingItem.close();
            await this.eliminarPedido(pedidoId);
          }
        }
      ]
    });
    await alert.present();
  }

  private async eliminarPedido(pedidoId: number) {
    const loading = await this.loadingCtrl.create({ message: 'Eliminando pedido...' });
    await loading.present();
    try {
      console.log(`Simulando eliminación de Pedido ${pedidoId}. Implementar en DatabaseService.`);
      this.mostrarToast(`Pedido #${pedidoId} eliminado (simulado).`);
      this.cargarPedidos();
    } catch (error) {
      console.error(`Error al eliminar el pedido ${pedidoId}:`, error);
      this.mostrarToast(`Error al eliminar el pedido #${pedidoId}.`);
    } finally {
      await loading.dismiss();
    }
  }

  async mostrarToast(mensaje: string, duracion: number = 2000) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: duracion,
      position: 'bottom'
    });
    toast.present();
  }

  ngOnDestroy() {
    if (this.dbReadySubscription) {
      this.dbReadySubscription.unsubscribe();
    }
  }
}