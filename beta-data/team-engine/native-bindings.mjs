// ABI layouts belong to the backend. Character packages select a backend;
// adding another character on an existing ABI does not add a name check here.
export const nativeBackends={
 legacy:{library:0,extension:false,slot:index=>index},
 extension:{library:1,extension:true,slot:index=>index+(index>=70?12:11)},
};
