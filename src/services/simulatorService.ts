import ROUTES from '../constants/routes.generated.json';

// A placeholder for the simulator service that moves buses along routes.
// The state is primarily consumed via useBusLocations hook.
class SimulatorService {
  start() {
    console.log('Simulator started');
  }

  stop() {
    console.log('Simulator stopped');
  }
}

export const simulatorService = new SimulatorService();
