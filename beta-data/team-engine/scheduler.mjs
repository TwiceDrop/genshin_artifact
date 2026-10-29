import {compareEvents,compareEventPosition,eventKey} from './event-order.mjs';

// The same queue serves compilation and scalar/symbolic state transitions.
// Candidate-dependent existence is an enabled numeric value on an event;
// candidate-dependent time must be lowered to reachable times by its producer.
export function createEventScheduler(initial=[]){
 const heap=[];let current;
 function enqueue(event){
  if(current&&compareEventPosition(event,current)<0)throw Error('事件不能早于其触发事件：'+eventKey(event));
  let i=heap.length;heap.push(event);
  while(i){const parent=(i-1)>>1;if(compareEvents(heap[parent],event)<=0)break;heap[i]=heap[parent];i=parent;}
  heap[i]=event;
 }
 function take(){
  const first=heap[0],last=heap.pop();
  if(heap.length){
   let i=0;
   while(i*2+1<heap.length){
    let child=i*2+1;if(child+1<heap.length&&compareEvents(heap[child+1],heap[child])<0)child++;
    if(compareEvents(last,heap[child])<=0)break;heap[i]=heap[child];i=child;
   }
   heap[i]=last;
  }
  return first;
 }
 initial.forEach(enqueue);
 return {enqueue,*events(){while(heap.length){current=take();yield current;}current=undefined;}};
}
