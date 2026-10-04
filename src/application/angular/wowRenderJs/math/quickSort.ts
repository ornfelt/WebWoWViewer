export type CompareFunc<T> = (a: T, b: T) => number;

class QuickSort {
    static swapItems<T>(items: T[], firstIndex: number, secondIndex: number): void {
        var temp = items[firstIndex];
        items[firstIndex] = items[secondIndex];
        items[secondIndex] = temp;
    }

    static partition<T>(items: T[], left: number, right: number, compareFunc: CompareFunc<T>): number {

        var pivot   = items[Math.floor((right + left) / 2)],
            i       = left,
            j       = right;


        while (i <= j) {

            while (compareFunc(items[i], pivot) < 0) {
                i++;
            }

            while (compareFunc(items[j], pivot) > 0){
                j--;
            }

            if (i <= j) {
                QuickSort.swapItems(items, i, j);
                i++;
                j--;
            }
        }

        return i;
    }

    static quickSort<T>(items: T[], left: number, right: number, compareFunc: CompareFunc<T>): T[] {
        var index: number;

        if (items.length > 1) {

            index = QuickSort.partition(items, left, right, compareFunc);

            if (left < index - 1) {
                QuickSort.quickSort(items, left, index - 1, compareFunc);
            }

            if (index < right) {
                QuickSort.quickSort(items, index, right, compareFunc);
            }

        }

        return items;
    }
    static multiQuickSort<T>(items: T[], left: number, right: number, ...compareFuncs: CompareFunc<T>[]): void;
    static multiQuickSort<T>(items: T[], left: number, right: number): void {
        var compareTimes = arguments.length - 3;
        var compareFuncs: CompareFunc<T>[] = new Array(compareTimes);
        for (var i = 0; i < compareFuncs.length; i++) {
            compareFuncs[i] = arguments[3 + i];
        }

        QuickSort.quickSort(items, left, right, compareFuncs[0]);
        if (compareFuncs.length > 1) {
            for (var i = 1; i < compareTimes; i++) {
                var newLeft = left;
                // JS-BUG: starts at 1 instead of left + 1; only correct when left == 0 (true for the current caller)
                var newRight = 1;
                while (newRight <= right) {
                    var compareResult = false;
                    for (var j = 0; (j < i) && (!compareResult); j++) {
                        compareResult = compareResult || (compareFuncs[j](items[newLeft], items[newRight]) != 0)
                    }
                    if (compareResult) {
                        if (newRight - newLeft > 1) {
                            QuickSort.quickSort(items, newLeft, newRight - 1, compareFuncs[i])
                        }
                        newLeft = newRight;
                    }
                    newRight++
                }
                if (newRight - newLeft > 1) {
                    QuickSort.quickSort(items, newLeft, newRight - 1, compareFuncs[i])
                }
            }
        }
    }

}
export default QuickSort;