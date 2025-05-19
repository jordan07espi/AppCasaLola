import { LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';


import { SQLite } from '@awesome-cordova-plugins/sqlite/ngx';

import { registerLocaleData } from '@angular/common';
import localeEsEc from '@angular/common/locales/es-EC';

// Registrar el locale globalmente
registerLocaleData(localeEsEc, 'es-EC');

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(), 
    AppRoutingModule     
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    SQLite,
    { provide: LOCALE_ID, useValue: 'es-EC' }
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}