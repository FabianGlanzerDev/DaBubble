import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { prepareEntryLocation } from './app/core/ui/entry-location';

prepareEntryLocation(window);
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
